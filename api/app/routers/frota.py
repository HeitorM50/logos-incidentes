from fastapi import APIRouter, Depends, Path

from app.core.autenticacao import obter_analista_atual
from app.core.banco import SessaoDep
from app.schemas.frota import MapaDaFrota, VeiculoResposta
from app.schemas.incidente import normalizar_placa
from app.services import frota as servico

# Telefone de motorista é dado pessoal: só com login (JWT), como os incidentes.
router = APIRouter(prefix="/veiculos", tags=["frota"], dependencies=[Depends(obter_analista_atual)])


@router.get(
    "/{placa}",
    response_model=VeiculoResposta,
    summary="Veículo da frota e o motorista atual (para preencher o contato no formulário)",
)
def obter_veiculo(sessao: SessaoDep, placa: str = Path(min_length=7, max_length=10)):
    try:
        normalizada = normalizar_placa(placa)
    except ValueError:
        normalizada = None
    return servico.obter_veiculo(sessao, normalizada or "")


# Mapa da frota (tela "Frota"): posições vêm da telemetria; também só com login.
router_mapa = APIRouter(
    prefix="/frota", tags=["frota"], dependencies=[Depends(obter_analista_atual)]
)


@router_mapa.get(
    "",
    response_model=MapaDaFrota,
    summary="Rodovias e a última posição de cada caminhão, com o incidente ativo dele",
)
def obter_mapa(sessao: SessaoDep):
    return servico.mapa(sessao)
