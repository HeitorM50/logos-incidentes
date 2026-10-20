from fastapi import APIRouter

from app import regras as modulo

router = APIRouter(tags=["regras"])


@router.get(
    "/regras",
    summary="Regras de negócio que o front repete (transições, limites dos campos, placa)",
)
def obter_regras() -> dict:
    # Pública como o /health: não há dado de incidente aqui, só as regras do código.
    return modulo.regras()
