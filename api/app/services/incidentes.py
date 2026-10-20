"""Regras de negócio dos incidentes.

Toda alteração passa por `_gravar_com_versao`, que aplica o controle de concorrência otimista
(ADR 0002): o UPDATE só afeta a linha se a versão no banco ainda for a que o cliente leu.
"""

from dataclasses import dataclass
from typing import Any

from sqlalchemy import case, delete, func, select, update
from sqlalchemy.orm import Session, joinedload

from app.core.dominio import Categoria, Criticidade, PapelAnalista, StatusIncidente, TipoEvento
from app.core.erros import ErroApi
from app.models import Analista, EventoIncidente, Incidente
from app.schemas.incidente import (
    ContagemCriticidade,
    EventoResposta,
    IncidenteCriar,
    IncidenteEditar,
    IncidenteResposta,
    ListaIncidentes,
)
from app.services.ciclo_vida import PODE_ASSUMIR, status_apos_liberar, transicao_permitida
from app.services.duplicatas import possiveis_duplicatas
from app.services.frota import completar_motorista


@dataclass(frozen=True)
class FiltrosIncidentes:
    criticidades: list[Criticidade]
    categorias: list[Categoria]
    status: list[StatusIncidente]
    responsavel_id: int | None = None


def _consulta_com_relacoes():
    return select(Incidente).options(
        joinedload(Incidente.responsavel),
        joinedload(Incidente.atualizado_por),
        joinedload(Incidente.dispositivo),
    )


def _aplicar_filtros(consulta, filtros: FiltrosIncidentes, *, com_criticidade: bool = True):
    if com_criticidade and filtros.criticidades:
        consulta = consulta.where(Incidente.criticidade.in_(filtros.criticidades))
    if filtros.categorias:
        consulta = consulta.where(Incidente.categoria.in_(filtros.categorias))
    if filtros.status:
        consulta = consulta.where(Incidente.status.in_(filtros.status))
    if filtros.responsavel_id is not None:
        consulta = consulta.where(Incidente.responsavel_id == filtros.responsavel_id)
    return consulta


def listar(sessao: Session, filtros: FiltrosIncidentes) -> ListaIncidentes:
    # Ordem de triagem (ADR 0004): ativos primeiro, depois criticidade (ordem do ENUM:
    # alta → baixa) e, dentro dela, o incidente aberto há mais tempo.
    fechados_por_ultimo = case((Incidente.status == StatusIncidente.FECHADO, 1), else_=0)
    consulta = _aplicar_filtros(_consulta_com_relacoes(), filtros).order_by(
        fechados_por_ultimo, Incidente.criticidade, Incidente.criado_em, Incidente.id
    )
    duplicatas = possiveis_duplicatas(sessao)
    itens = [
        IncidenteResposta.model_validate(i).model_copy(
            update={"possivel_duplicata_de": duplicatas.get(i.id)}
        )
        for i in sessao.scalars(consulta).unique()
    ]

    # Os contadores do topo ignoram o filtro de criticidade: mostram o total de cada nível.
    contagem = _aplicar_filtros(
        select(Incidente.criticidade, func.count()), filtros, com_criticidade=False
    ).group_by(Incidente.criticidade)
    por_criticidade = {criticidade.value: total for criticidade, total in sessao.execute(contagem)}

    return ListaIncidentes(
        itens=itens,
        total=len(itens),
        contagem_por_criticidade=ContagemCriticidade(**por_criticidade),
    )


def _buscar(sessao: Session, incidente_id: int) -> Incidente:
    consulta = _consulta_com_relacoes().where(Incidente.id == incidente_id)
    incidente = sessao.scalars(consulta.execution_options(populate_existing=True)).first()
    if incidente is None:
        raise ErroApi(404, "nao_encontrado", "Incidente não encontrado.")
    return incidente


def obter(sessao: Session, incidente_id: int) -> IncidenteResposta:
    resposta = IncidenteResposta.model_validate(_buscar(sessao, incidente_id))
    duplicata_de = possiveis_duplicatas(sessao).get(incidente_id)
    return resposta.model_copy(update={"possivel_duplicata_de": duplicata_de})


def criar(sessao: Session, dados: IncidenteCriar, analista_id: int) -> IncidenteResposta:
    incidente = Incidente(
        **completar_motorista(sessao, dados.model_dump()),
        status=StatusIncidente.ABERTO,
        versao=1,
        atualizado_por_id=analista_id,
    )
    sessao.add(incidente)
    sessao.flush()  # gera o id para o evento, na mesma transação
    sessao.add(
        EventoIncidente(
            incidente_id=incidente.id,
            tipo=TipoEvento.CRIADO,
            analista_id=analista_id,
            status_novo=StatusIncidente.ABERTO,
        )
    )
    sessao.commit()
    return obter(sessao, incidente.id)


def _conflito(sessao: Session, incidente_id: int) -> ErroApi:
    atual = obter(sessao, incidente_id)
    return ErroApi(
        409,
        "conflito_versao",
        "Outro analista alterou este incidente. Confira a versão atual.",
        atual=atual,
    )


def _exigir_versao_atual(sessao: Session, incidente: Incidente, versao_lida: int) -> None:
    if incidente.versao != versao_lida:
        raise _conflito(sessao, incidente.id)


def _exigir_aberto_para_alteracao(incidente: Incidente) -> None:
    if incidente.status == StatusIncidente.FECHADO:
        raise ErroApi(422, "incidente_fechado", "Incidente fechado não pode ser alterado.")


def _exigir_responsavel_ou_livre(incidente: Incidente, analista_id: int) -> None:
    """Com responsável definido, só ele altera o incidente (ADR 0002)."""
    if incidente.responsavel is not None and incidente.responsavel_id != analista_id:
        raise ErroApi(
            403,
            "nao_responsavel",
            f"Este incidente está sendo tratado por {incidente.responsavel.nome}.",
        )


def _gravar_com_versao(
    sessao: Session,
    incidente_id: int,
    versao_lida: int,
    analista_id: int,
    valores: dict[str, Any],
    evento: EventoIncidente,
) -> IncidenteResposta:
    """UPDATE com a versão lida + evento do histórico, na mesma transação: ou os dois ficam
    gravados, ou nenhum (um 409 não deixa evento de uma alteração que não aconteceu)."""
    resultado = sessao.execute(
        update(Incidente)
        .where(Incidente.id == incidente_id, Incidente.versao == versao_lida)
        .values(
            **valores,
            versao=Incidente.versao + 1,
            atualizado_por_id=analista_id,
            atualizado_em=func.now(),
        )
        .returning(Incidente.id)
    )
    if resultado.first() is None:
        # Outra requisição gravou entre a leitura e o UPDATE.
        sessao.rollback()
        raise _conflito(sessao, incidente_id)
    evento.incidente_id = incidente_id
    evento.analista_id = analista_id
    sessao.add(evento)
    sessao.commit()
    return obter(sessao, incidente_id)


def editar(
    sessao: Session, incidente_id: int, dados: IncidenteEditar, analista_id: int
) -> IncidenteResposta:
    incidente = _buscar(sessao, incidente_id)
    _exigir_versao_atual(sessao, incidente, dados.versao)
    _exigir_aberto_para_alteracao(incidente)
    _exigir_responsavel_ou_livre(incidente, analista_id)
    alteracoes = dados.alteracoes()
    # Só conta o que mudou de fato ("" e nulo são o mesmo texto vazio).
    campos = [
        campo
        for campo, valor in alteracoes.items()
        if (getattr(incidente, campo) or None) != (valor or None)
    ]
    if not campos:
        # Mandar os mesmos valores não é edição: sem nova versão (não gera 409 falso nos outros
        # analistas) e sem evento vazio no histórico.
        return IncidenteResposta.model_validate(incidente)
    return _gravar_com_versao(
        sessao,
        incidente_id,
        dados.versao,
        analista_id,
        alteracoes,
        EventoIncidente(tipo=TipoEvento.EDITADO, campos=campos),
    )


def assumir(
    sessao: Session, incidente_id: int, versao_lida: int, analista_id: int
) -> IncidenteResposta:
    incidente = _buscar(sessao, incidente_id)
    if incidente.responsavel_id == analista_id:
        return IncidenteResposta.model_validate(incidente)  # já é dele: nada a fazer
    # "Já assumido" vem antes da versão: é a mensagem que explica o conflito ao analista.
    if incidente.responsavel is not None:
        raise ErroApi(
            409,
            "ja_assumido",
            f"{incidente.responsavel.nome} já assumiu este incidente.",
            atual=IncidenteResposta.model_validate(incidente),
        )
    _exigir_versao_atual(sessao, incidente, versao_lida)
    _exigir_aberto_para_alteracao(incidente)
    if incidente.status not in PODE_ASSUMIR:
        raise ErroApi(422, "transicao_invalida", "Este incidente não pode ser assumido agora.")
    return _gravar_com_versao(
        sessao,
        incidente_id,
        versao_lida,
        analista_id,
        {"responsavel_id": analista_id, "status": StatusIncidente.EM_INVESTIGACAO},
        EventoIncidente(
            tipo=TipoEvento.ASSUMIDO,
            status_anterior=incidente.status,
            status_novo=StatusIncidente.EM_INVESTIGACAO,
        ),
    )


def liberar(
    sessao: Session,
    incidente_id: int,
    versao_lida: int,
    analista_id: int,
    comentario: str | None = None,
) -> IncidenteResposta:
    incidente = _buscar(sessao, incidente_id)
    _exigir_versao_atual(sessao, incidente, versao_lida)
    _exigir_aberto_para_alteracao(incidente)
    if incidente.responsavel_id != analista_id:
        raise ErroApi(403, "nao_responsavel", "Só o responsável pode liberar o incidente.")
    return _gravar_com_versao(
        sessao,
        incidente_id,
        versao_lida,
        analista_id,
        {"responsavel_id": None, "status": status_apos_liberar(incidente.status)},
        EventoIncidente(
            tipo=TipoEvento.LIBERADO,
            status_anterior=incidente.status,
            status_novo=status_apos_liberar(incidente.status),
            comentario=comentario,
        ),
    )


def mudar_status(
    sessao: Session,
    incidente_id: int,
    versao_lida: int,
    novo_status: StatusIncidente,
    analista_id: int,
    comentario: str | None = None,
) -> IncidenteResposta:
    incidente = _buscar(sessao, incidente_id)
    _exigir_versao_atual(sessao, incidente, versao_lida)
    _exigir_aberto_para_alteracao(incidente)
    if incidente.responsavel_id is None:
        raise ErroApi(422, "transicao_invalida", "Assuma o incidente antes de mudar o status.")
    _exigir_responsavel_ou_livre(incidente, analista_id)
    if not transicao_permitida(incidente.status, novo_status):
        raise ErroApi(
            422,
            "transicao_invalida",
            f"Não é possível mudar de {incidente.status.value} para {novo_status.value}.",
        )
    return _gravar_com_versao(
        sessao,
        incidente_id,
        versao_lida,
        analista_id,
        {"status": novo_status},
        EventoIncidente(
            tipo=TipoEvento.STATUS,
            status_anterior=incidente.status,
            status_novo=novo_status,
            comentario=comentario,
        ),
    )


def transferir(
    sessao: Session,
    incidente_id: int,
    versao_lida: int,
    supervisor: Analista,
    destino_id: int,
    comentario: str | None = None,
) -> IncidenteResposta:
    """O supervisor passa o incidente para outro analista (ex.: troca de turno, sobrecarga).

    Passa pelo controle de versão como qualquer alteração; um Aberto vai para Em Investigação,
    como ao assumir.
    """
    if supervisor.papel != PapelAnalista.SUPERVISOR:
        raise ErroApi(403, "so_supervisor", "Só um supervisor pode transferir incidentes.")
    incidente = _buscar(sessao, incidente_id)
    _exigir_versao_atual(sessao, incidente, versao_lida)
    _exigir_aberto_para_alteracao(incidente)
    if sessao.get(Analista, destino_id) is None:
        raise ErroApi(422, "analista_invalido", "O analista de destino não existe.")
    if incidente.responsavel_id == destino_id:
        raise ErroApi(422, "ja_responsavel", "Este analista já é o responsável.")
    novo_status = (
        StatusIncidente.EM_INVESTIGACAO
        if incidente.status == StatusIncidente.ABERTO
        else incidente.status
    )
    return _gravar_com_versao(
        sessao,
        incidente_id,
        versao_lida,
        supervisor.id,
        {"responsavel_id": destino_id, "status": novo_status},
        EventoIncidente(
            tipo=TipoEvento.TRANSFERIDO,
            status_anterior=incidente.status,
            status_novo=novo_status,
            comentario=comentario,
            responsavel_novo_id=destino_id,
        ),
    )


def remover(sessao: Session, incidente_id: int, versao_lida: int, analista_id: int) -> None:
    incidente = _buscar(sessao, incidente_id)
    _exigir_versao_atual(sessao, incidente, versao_lida)
    # Fechado é registro histórico da operação: não pode ser apagado.
    _exigir_aberto_para_alteracao(incidente)
    _exigir_responsavel_ou_livre(incidente, analista_id)
    resultado = sessao.execute(
        delete(Incidente)
        .where(Incidente.id == incidente_id, Incidente.versao == versao_lida)
        .returning(Incidente.id)
    )
    if resultado.first() is None:
        sessao.rollback()
        raise _conflito(sessao, incidente_id)
    sessao.commit()


def listar_eventos(sessao: Session, incidente_id: int) -> list[EventoResposta]:
    """Histórico do incidente, do mais antigo ao mais novo."""
    _buscar(sessao, incidente_id)  # 404 se não existe
    consulta = (
        select(EventoIncidente)
        .options(joinedload(EventoIncidente.analista), joinedload(EventoIncidente.responsavel_novo))
        .where(EventoIncidente.incidente_id == incidente_id)
        .order_by(EventoIncidente.criado_em, EventoIncidente.id)
    )
    return [EventoResposta.model_validate(e) for e in sessao.scalars(consulta)]
