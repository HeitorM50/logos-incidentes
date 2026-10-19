from fastapi import APIRouter, Request

from app.core.autenticacao import AnalistaAtualDep
from app.core.banco import SessaoDep
from app.core.limite import limitador
from app.schemas.auth import AnalistaLogado, Credenciais, TokenAcesso
from app.services import auth as servico

router = APIRouter(prefix="/auth", tags=["autenticação"])


@router.post(
    "/login", response_model=TokenAcesso, summary="Autentica o analista e devolve um token"
)
@limitador.limit("5/minute")
def entrar(request: Request, credenciais: Credenciais, sessao: SessaoDep):
    # `request` é exigido pelo slowapi para identificar o cliente.
    return servico.autenticar(sessao, credenciais)


@router.get("/eu", response_model=AnalistaLogado, summary="Dados do analista autenticado")
def quem_sou_eu(analista: AnalistaAtualDep):
    return analista
