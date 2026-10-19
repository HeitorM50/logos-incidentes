from functools import lru_cache
from typing import Annotated

from pydantic import Field, field_validator
from pydantic_settings import BaseSettings, NoDecode, SettingsConfigDict


class Configuracao(BaseSettings):
    """Configuração lida de variáveis de ambiente (ou do arquivo .env em desenvolvimento)."""

    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    database_url: str
    jwt_segredo: str = Field(min_length=16)
    jwt_validade_horas: int = 8
    cors_origens: Annotated[list[str], NoDecode] = ["http://localhost:5173"]

    # Tempo máximo de uma consulta no banco antes de ser cancelada (ADR 0003).
    timeout_consulta_ms: int = 5000

    # Simulação de falha para demonstração. Desligada por padrão.
    simular_latencia_ms: int = Field(default=0, ge=0, le=30_000)
    simular_falha_pct: float = Field(default=0, ge=0, le=100)

    @field_validator("cors_origens", mode="before")
    @classmethod
    def separar_origens(cls, valor: str | list[str]) -> list[str]:
        if isinstance(valor, str):
            return [origem.strip() for origem in valor.split(",") if origem.strip()]
        return valor


@lru_cache
def obter_configuracao() -> Configuracao:
    return Configuracao()
