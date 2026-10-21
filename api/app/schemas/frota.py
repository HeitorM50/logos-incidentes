from datetime import datetime

from pydantic import BaseModel, ConfigDict

from app.core.dominio import Criticidade


class MotoristaResposta(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    nome: str
    telefone: str


class VeiculoResposta(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    placa: str
    modelo: str
    motorista: MotoristaResposta | None


class IncidenteDoVeiculo(BaseModel):
    id: int
    titulo: str
    criticidade: Criticidade


class PosicaoVeiculo(BaseModel):
    placa: str
    modelo: str
    motorista: str | None
    latitude: float | None
    longitude: float | None
    velocidade_kmh: int | None
    ignicao: bool | None
    referencia: str | None
    ultima_leitura_em: datetime | None
    parado_desde: datetime | None
    # O incidente ativo mais crítico do caminhão (o mais antigo, no empate).
    incidente: IncidenteDoVeiculo | None


class RotaDoMapa(BaseModel):
    rodovia: str
    pontos: list[tuple[float, float]]


class MapaDaFrota(BaseModel):
    rotas: list[RotaDoMapa]
    veiculos: list[PosicaoVeiculo]
