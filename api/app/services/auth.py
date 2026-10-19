from datetime import timedelta

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.config import obter_configuracao
from app.core.erros import ErroApi
from app.core.limite import falhas_login
from app.core.seguranca import HASH_FICTICIO, criar_token, senha_confere
from app.models import Analista
from app.schemas.auth import AnalistaLogado, Credenciais, TokenAcesso


def autenticar(sessao: Session, credenciais: Credenciais) -> TokenAcesso:
    usuario = credenciais.usuario.lower()
    if falhas_login.bloqueado(usuario):
        raise ErroApi(
            429,
            "muitas_tentativas",
            "Muitas tentativas de login. Aguarde um minuto e tente de novo.",
            cabecalhos={"Retry-After": "60"},
        )
    analista = sessao.scalars(select(Analista).where(Analista.usuario == usuario)).first()
    # Sempre roda o bcrypt, mesmo sem usuário, para não revelar quem existe pelo tempo de resposta.
    senha_hash = analista.senha_hash if analista else HASH_FICTICIO
    if not senha_confere(credenciais.senha, senha_hash) or analista is None:
        falhas_login.registrar_falha(usuario)
        raise ErroApi(401, "credenciais_invalidas", "Usuário ou senha incorretos.")
    falhas_login.limpar(usuario)

    config = obter_configuracao()
    token, expira_em = criar_token(
        analista.id, config.jwt_segredo, timedelta(hours=config.jwt_validade_horas)
    )
    return TokenAcesso(
        token=token, expira_em=expira_em, analista=AnalistaLogado.model_validate(analista)
    )
