from typing import Annotated

from fastapi import Depends
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer

from app.core.banco import SessaoDep
from app.core.config import obter_configuracao
from app.core.erros import ErroApi
from app.core.seguranca import ler_analista_do_token
from app.models import Analista

esquema_bearer = HTTPBearer(auto_error=False, description="Token obtido em POST /auth/login")


def _nao_autenticado() -> ErroApi:
    return ErroApi(
        401,
        "nao_autenticado",
        "Sessão inválida ou expirada. Entre novamente.",
        cabecalhos={"WWW-Authenticate": "Bearer"},
    )


def obter_analista_atual(
    sessao: SessaoDep,
    credenciais: Annotated[HTTPAuthorizationCredentials | None, Depends(esquema_bearer)],
) -> Analista:
    if credenciais is None:
        raise _nao_autenticado()
    analista_id = ler_analista_do_token(credenciais.credentials, obter_configuracao().jwt_segredo)
    analista = sessao.get(Analista, analista_id) if analista_id is not None else None
    if analista is None:
        raise _nao_autenticado()
    return analista


AnalistaAtualDep = Annotated[Analista, Depends(obter_analista_atual)]
