from datetime import datetime
from typing import Annotated

from pydantic import BaseModel, StringConstraints

from app.schemas.incidente import AnalistaResumo, EntradaEstrita


class Credenciais(EntradaEstrita):
    usuario: Annotated[str, StringConstraints(strip_whitespace=True, min_length=1, max_length=40)]
    senha: Annotated[str, StringConstraints(min_length=1, max_length=128)]


class AnalistaLogado(AnalistaResumo):
    usuario: str


class TokenAcesso(BaseModel):
    token: str
    expira_em: datetime
    analista: AnalistaLogado
