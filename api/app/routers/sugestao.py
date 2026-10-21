from functools import lru_cache
from typing import Annotated

from fastapi import APIRouter, Depends
from limits import parse

from app.core.autenticacao import AnalistaAtualDep, obter_analista_atual
from app.core.config import obter_configuracao
from app.core.erros import ErroApi
from app.core.limite import limitador
from app.schemas.sugestao import DisponibilidadeSugestao, PedidoSugestao, SugestaoResposta
from app.services import sugestao as servico

router = APIRouter(
    prefix="/sugestao", tags=["sugestao"], dependencies=[Depends(obter_analista_atual)]
)

LIMITE_POR_ANALISTA = parse("5/minute")


@lru_cache
def _extrator_padrao() -> servico.Extrator | None:
    return servico.criar_extrator(obter_configuracao())


def obter_extrator() -> servico.Extrator | None:
    # Dependência separada: os testes trocam o Claude por um extrator falso.
    return _extrator_padrao()


ExtratorDep = Annotated[servico.Extrator | None, Depends(obter_extrator)]


@router.get(
    "",
    response_model=DisponibilidadeSugestao,
    summary="Diz se a sugestão pela IA está ligada (há chave da Anthropic configurada)",
)
def disponibilidade(extrator: ExtratorDep):
    return DisponibilidadeSugestao(disponivel=extrator is not None)


@router.post(
    "",
    response_model=SugestaoResposta,
    summary="Sugere os campos de um incidente a partir da mensagem do motorista",
)
def sugerir(pedido: PedidoSugestao, analista: AnalistaAtualDep, extrator: ExtratorDep):
    if extrator is None:
        raise ErroApi(503, "ia_desligada", "A sugestão pela IA não está ligada neste ambiente.")
    if limitador.enabled:
        if not limitador.limiter.hit(LIMITE_POR_ANALISTA, "sugestao", str(analista.id)):
            raise ErroApi(
                429,
                "muitas_tentativas",
                "Muitos pedidos de sugestão. Aguarde um minuto.",
                cabecalhos={"Retry-After": "60"},
            )
        limite_diario = parse(f"{obter_configuracao().sugestao_limite_diario}/day")
        if not limitador.limiter.hit(limite_diario, "sugestao", "todos"):
            raise ErroApi(
                429,
                "cota_ia_esgotada",
                "A cota diária da IA neste ambiente acabou. Preencha à mão.",
                cabecalhos={"Retry-After": "3600"},
            )
    return servico.sugerir(pedido.mensagem, extrator)
