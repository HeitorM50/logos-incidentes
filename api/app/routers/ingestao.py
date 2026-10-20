from typing import Annotated

from fastapi import APIRouter, Header, Response, status

from app.core.banco import SessaoDep
from app.core.dispositivo import DispositivoDep
from app.schemas.incidente import IncidenteCriar, IncidenteResposta
from app.services import ingestao as servico

router = APIRouter(prefix="/ingestao", tags=["ingestão (caminhões)"])

# Letras, números, hífen e sublinhado (cabe um UUID): evita guardar texto livre como chave.
PADRAO_CHAVE = r"^[A-Za-z0-9_-]{8,64}$"


@router.post(
    "/incidentes",
    response_model=IncidenteResposta,
    status_code=status.HTTP_201_CREATED,
    summary="Recebe um incidente enviado por um caminhão",
    responses={200: {"description": "Reenvio: o incidente já tinha sido criado com esta chave"}},
)
def receber_incidente(
    response: Response,
    dados: IncidenteCriar,
    dispositivo: DispositivoDep,
    sessao: SessaoDep,
    chave: Annotated[
        str,
        Header(
            alias="Idempotency-Key",
            pattern=PADRAO_CHAVE,
            description="Identificador único do envio (ex.: UUID). Reenvios com a mesma chave "
            "devolvem o mesmo incidente, sem duplicar.",
        ),
    ],
):
    # O limite por IP roda antes da autenticação (app/core/dispositivo.py).
    incidente, novo = servico.receber(sessao, dispositivo, chave, dados)
    if not novo:
        response.status_code = status.HTTP_200_OK
        response.headers["Idempotent-Replayed"] = "true"
    return incidente
