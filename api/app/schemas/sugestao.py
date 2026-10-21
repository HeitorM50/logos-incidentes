from typing import Annotated

from pydantic import BaseModel, Field, StringConstraints

from app.core.dominio import Categoria, Criticidade
from app.schemas.incidente import EntradaEstrita, TextoSeguro

MensagemMotorista = Annotated[
    str, StringConstraints(strip_whitespace=True, min_length=10, max_length=2000), TextoSeguro
]


class PedidoSugestao(EntradaEstrita):
    mensagem: MensagemMotorista = Field(
        description="Mensagem do motorista como chegou (WhatsApp, ligação transcrita)"
    )


class DisponibilidadeSugestao(BaseModel):
    disponivel: bool


class SugestaoResposta(BaseModel):
    """Campos do formulário de novo incidente, para o analista conferir antes de salvar."""

    titulo: str
    descricao: str
    categoria: Categoria
    criticidade: Criticidade
    local: str | None
    placa: str | None
    motorista_nome: str | None
    justificativa: str = Field(description="Por que a IA escolheu esta criticidade")
