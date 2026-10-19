from fastapi import APIRouter
from fastapi.responses import JSONResponse
from sqlalchemy import text
from sqlalchemy.exc import SQLAlchemyError

from app.core.banco import SessaoSemRetryDep

router = APIRouter(tags=["saúde"])


@router.get("/health", summary="Verifica se a API e o banco respondem")
def verificar_saude(sessao: SessaoSemRetryDep):
    try:
        sessao.execute(text("SELECT 1"))
    except SQLAlchemyError:
        return JSONResponse(
            status_code=503, content={"status": "degradado", "banco": "indisponivel"}
        )
    return {"status": "ok", "banco": "ok"}
