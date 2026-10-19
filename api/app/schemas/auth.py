from datetime import datetime
from typing import Annotated

from pydantic import BaseModel, StringConstraints, field_validator

from app.schemas.incidente import AnalistaResumo, EntradaEstrita, TextoSeguro

# O bcrypt só considera os primeiros 72 bytes da senha e rejeita entradas maiores.
MAXIMO_BYTES_SENHA = 72


class Credenciais(EntradaEstrita):
    usuario: Annotated[
        str, StringConstraints(strip_whitespace=True, min_length=1, max_length=40), TextoSeguro
    ]
    senha: Annotated[str, StringConstraints(min_length=1)]

    @field_validator("senha")
    @classmethod
    def limitar_bytes_da_senha(cls, senha: str) -> str:
        if len(senha.encode()) > MAXIMO_BYTES_SENHA:
            raise ValueError(f"a senha deve ter no máximo {MAXIMO_BYTES_SENHA} bytes")
        return senha


class AnalistaLogado(AnalistaResumo):
    usuario: str


class TokenAcesso(BaseModel):
    token: str
    expira_em: datetime
    analista: AnalistaLogado
