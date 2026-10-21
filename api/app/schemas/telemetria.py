from datetime import datetime
from typing import Annotated

from pydantic import BaseModel, Field, field_validator

from app.core.dominio import Criticidade
from app.schemas.incidente import EntradaEstrita, TextoSeguro, normalizar_placa


class Sinais(EntradaEstrita):
    """Sensores do caminhão. Ausente = sem leitura daquele sensor."""

    panico: bool = False
    impacto_g: float | None = Field(default=None, ge=0, le=50)
    temperatura_motor_c: float | None = Field(default=None, ge=-40, le=200)
    visibilidade_m: int | None = Field(default=None, ge=0, le=100_000)


class Leitura(EntradaEstrita):
    placa: str
    latitude: float = Field(ge=-90, le=90)
    longitude: float = Field(ge=-180, le=180)
    velocidade_kmh: int = Field(ge=0, le=200)
    ignicao: bool = True
    # Endereço ou ponto de referência que a central de rastreamento já resolve ("BR-116, km 412").
    referencia: Annotated[str, Field(max_length=160), TextoSeguro] | None = None
    registrado_em: datetime | None = None
    sinais: Sinais = Field(default_factory=Sinais)

    @field_validator("placa")
    @classmethod
    def _placa(cls, valor: str) -> str:
        placa = normalizar_placa(valor)
        if placa is None:
            raise ValueError("placa obrigatória")
        return placa


class LoteTelemetria(EntradaEstrita):
    """Leituras de vários caminhões num envio, como uma central de rastreamento integra."""

    leituras: list[Leitura] = Field(min_length=1, max_length=200)


class IncidenteGerado(BaseModel):
    id: int
    placa: str
    regra: str
    criticidade: Criticidade


class ResultadoTelemetria(BaseModel):
    processadas: int
    # Placas fora do cadastro da frota: a leitura é descartada.
    ignoradas: int
    incidentes: list[IncidenteGerado]
