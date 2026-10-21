from fastapi import APIRouter

from app.core.banco import SessaoDep
from app.core.dispositivo import DispositivoDep
from app.schemas.telemetria import LoteTelemetria, ResultadoTelemetria
from app.services import telemetria as servico

router = APIRouter(tags=["telemetria (central de rastreamento)"])


@router.post(
    "/telemetria",
    response_model=ResultadoTelemetria,
    summary="Recebe leituras dos caminhões e abre incidentes pelas regras",
)
def receber_telemetria(lote: LoteTelemetria, dispositivo: DispositivoDep, sessao: SessaoDep):
    # Mesma autenticação e limite por IP da ingestão (app/core/dispositivo.py).
    return servico.receber(sessao, dispositivo, lote)
