from fastapi import APIRouter, Depends
from sqlalchemy import select

from app.core.autenticacao import obter_analista_atual
from app.core.banco import SessaoDep
from app.models import Analista
from app.schemas.incidente import AnalistaComPapel

router = APIRouter(
    prefix="/analistas", tags=["analistas"], dependencies=[Depends(obter_analista_atual)]
)


@router.get(
    "",
    response_model=list[AnalistaComPapel],
    summary="Analistas da central (destinos da transferência)",
)
def listar_analistas(sessao: SessaoDep):
    return sessao.scalars(select(Analista).order_by(Analista.nome)).all()
