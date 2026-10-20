from pydantic import BaseModel, ConfigDict


class MotoristaResposta(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    nome: str
    telefone: str


class VeiculoResposta(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    placa: str
    modelo: str
    motorista: MotoristaResposta | None
