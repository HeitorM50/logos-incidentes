"""Senhas com bcrypt e tokens JWT (ADR 0005)."""

from datetime import UTC, datetime, timedelta

import bcrypt
import jwt

ALGORITMO_JWT = "HS256"


def gerar_hash_senha(senha: str) -> str:
    return bcrypt.hashpw(senha.encode(), bcrypt.gensalt()).decode()


def senha_confere(senha: str, senha_hash: str) -> bool:
    return bcrypt.checkpw(senha.encode(), senha_hash.encode())


# Hash usado quando o usuário não existe: o login leva o mesmo tempo nos dois casos,
# então a resposta não revela quais usuários existem.
HASH_FICTICIO = gerar_hash_senha("senha-ficticia-para-tempo-constante")


def criar_token(analista_id: int, segredo: str, validade: timedelta) -> tuple[str, datetime]:
    agora = datetime.now(UTC)
    expira_em = agora + validade
    token = jwt.encode(
        {"sub": str(analista_id), "iat": agora, "exp": expira_em}, segredo, ALGORITMO_JWT
    )
    return token, expira_em


def ler_analista_do_token(token: str, segredo: str) -> int | None:
    """Devolve o id do analista, ou None se o token for inválido ou estiver expirado."""
    try:
        conteudo = jwt.decode(
            token, segredo, algorithms=[ALGORITMO_JWT], options={"require": ["sub", "exp"]}
        )
        return int(conteudo["sub"])
    except (jwt.InvalidTokenError, ValueError):
        return None
