"""Incidentes enviados direto pelos caminhões, com idempotência (ADR 0008)."""

import hashlib
import json
from datetime import UTC, datetime, timedelta

from sqlalchemy import func, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.core.dominio import StatusIncidente, TipoEvento
from app.core.erros import ErroApi
from app.models import Dispositivo, EventoIncidente, Incidente, Ingestao
from app.schemas.incidente import IncidenteCriar, IncidenteResposta
from app.services.frota import completar_motorista
from app.services.incidentes import obter

# Cota por dispositivo: protege a triagem de um rastreador com defeito (ou da chave de
# demonstração, que é pública) enchendo a fila de incidentes.
COTA_POR_HORA = 30


def _hash_do_corpo(dados: IncidenteCriar) -> str:
    canonico = json.dumps(dados.model_dump(mode="json"), sort_keys=True, ensure_ascii=False)
    return hashlib.sha256(canonico.encode()).hexdigest()


def _ja_recebido(sessao: Session, dispositivo: Dispositivo, chave: str) -> Ingestao | None:
    return sessao.scalars(
        select(Ingestao).where(Ingestao.dispositivo_id == dispositivo.id, Ingestao.chave == chave)
    ).first()


def _resposta_do_reenvio(sessao: Session, ingestao: Ingestao, corpo_hash: str) -> IncidenteResposta:
    if ingestao.corpo_hash != corpo_hash:
        # A mesma chave com outro conteúdo é defeito do rastreador: devolver o incidente antigo
        # com 200 faria a ocorrência nova sumir em silêncio.
        raise ErroApi(
            422,
            "chave_reutilizada",
            "Esta Idempotency-Key já foi usada com outro conteúdo. Gere uma chave por envio.",
        )
    removido = ErroApi(
        409, "ja_recebido", "Este envio já foi recebido, e a central removeu o incidente depois."
    )
    if ingestao.incidente_id is None:
        raise removido
    try:
        return obter(sessao, ingestao.incidente_id)
    except ErroApi as erro:
        if erro.status == 404:  # removido entre a leitura e a busca
            raise removido from erro
        raise


def _exigir_cota(sessao: Session, dispositivo: Dispositivo) -> None:
    desde = datetime.now(UTC) - timedelta(hours=1)
    na_ultima_hora = sessao.scalar(
        select(func.count())
        .select_from(Ingestao)
        .where(Ingestao.dispositivo_id == dispositivo.id, Ingestao.criado_em >= desde)
    )
    if na_ultima_hora >= COTA_POR_HORA:
        raise ErroApi(
            429,
            "cota_do_dispositivo",
            f"Este dispositivo já enviou {COTA_POR_HORA} incidentes na última hora.",
            cabecalhos={"Retry-After": "600"},
        )


def _violou_a_chave_unica(erro: IntegrityError) -> bool:
    diagnostico = getattr(erro.orig, "diag", None)
    return getattr(diagnostico, "constraint_name", None) == "uq_ingestoes_chave"


def receber(
    sessao: Session, dispositivo: Dispositivo, chave: str, dados: IncidenteCriar
) -> tuple[IncidenteResposta, bool]:
    """Cria o incidente, ou devolve o já criado com a mesma chave. O bool diz se é novo."""
    corpo_hash = _hash_do_corpo(dados)
    anterior = _ja_recebido(sessao, dispositivo, chave)
    if anterior is not None:
        return _resposta_do_reenvio(sessao, anterior, corpo_hash), False
    _exigir_cota(sessao, dispositivo)

    valores = dados.model_dump()
    # Sem placa no corpo, vale a placa cadastrada do caminhão.
    if valores.get("placa") is None:
        valores["placa"] = dispositivo.placa
    # O caminhão não sabe o telefone do motorista: a API copia do cadastro da frota.
    valores = completar_motorista(sessao, valores)
    incidente = Incidente(
        **valores,
        status=StatusIncidente.ABERTO,
        versao=1,
        dispositivo_id=dispositivo.id,
    )
    sessao.add(incidente)
    sessao.flush()
    sessao.add(
        EventoIncidente(
            incidente_id=incidente.id, tipo=TipoEvento.CRIADO, status_novo=StatusIncidente.ABERTO
        )
    )
    sessao.add(
        Ingestao(
            dispositivo_id=dispositivo.id,
            chave=chave,
            corpo_hash=corpo_hash,
            incidente_id=incidente.id,
        )
    )
    try:
        sessao.commit()
    except IntegrityError as erro:
        sessao.rollback()
        # Só a restrição de idempotência quer dizer "outro reenvio gravou primeiro"; qualquer
        # outra violação é erro de verdade e não pode virar um 200.
        if not _violou_a_chave_unica(erro):
            raise
        # Nada deste envio fica gravado (incidente, evento e registro saem juntos no
        # rollback), e a resposta é a do vencedor.
        vencedor = _ja_recebido(sessao, dispositivo, chave)
        if vencedor is None:
            raise
        return _resposta_do_reenvio(sessao, vencedor, corpo_hash), False
    return obter(sessao, incidente.id), True
