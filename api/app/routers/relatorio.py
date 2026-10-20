from typing import Annotated

from fastapi import APIRouter, Depends, Query
from pydantic import AfterValidator

from app.core.autenticacao import obter_analista_atual
from app.core.banco import SessaoDep
from app.schemas.relatorio import RelatorioResposta
from app.services import relatorio as servico

router = APIRouter(tags=["relatorio"], dependencies=[Depends(obter_analista_atual)])

PERIODOS_HORAS = (6, 24, 168)


def _periodo_valido(horas: int) -> int:
    if horas not in PERIODOS_HORAS:
        raise ValueError("use 6, 24 ou 168 horas")
    return horas


Periodo = Annotated[int, AfterValidator(_periodo_valido)]


@router.get(
    "/relatorio",
    response_model=RelatorioResposta,
    summary="Funil do atendimento, tempos médios e recebidos por hora no período",
)
def obter_relatorio(
    sessao: SessaoDep,
    horas: Annotated[Periodo, Query(description="Tamanho do período: 6 h, 24 h ou 7 dias")] = 24,
):
    return servico.gerar(sessao, horas)
