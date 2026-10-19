import re
from datetime import datetime
from typing import Annotated

from pydantic import (
    BaseModel,
    ConfigDict,
    Field,
    StringConstraints,
    field_validator,
    model_validator,
)

from app.core.dominio import Categoria, Criticidade, StatusIncidente

# Placa no padrão antigo (ABC1234) ou Mercosul (ABC1D23).
PADRAO_PLACA = re.compile(r"^[A-Z]{3}[0-9][A-Z0-9][0-9]{2}$")

Titulo = Annotated[str, StringConstraints(strip_whitespace=True, min_length=3, max_length=120)]
Descricao = Annotated[str, StringConstraints(strip_whitespace=True, max_length=2000)]
Local = Annotated[str, StringConstraints(strip_whitespace=True, min_length=3, max_length=160)]
Versao = Annotated[int, Field(ge=1, description="Versão do incidente que o cliente leu")]


def _normalizar_placa(valor: str | None) -> str | None:
    if valor is None:
        return None
    placa = valor.replace("-", "").replace(" ", "").upper()
    if not placa:
        return None
    if not PADRAO_PLACA.match(placa):
        raise ValueError("placa inválida; use o formato ABC1234 ou ABC1D23")
    return placa


class EntradaEstrita(BaseModel):
    # Campos desconhecidos são rejeitados: o cliente não consegue gravar o que não deveria.
    model_config = ConfigDict(extra="forbid")


class IncidenteCriar(EntradaEstrita):
    titulo: Titulo
    descricao: Descricao | None = None
    categoria: Categoria
    criticidade: Criticidade
    local: Local
    placa: str | None = None

    _placa = field_validator("placa")(_normalizar_placa)


class IncidenteEditar(EntradaEstrita):
    versao: Versao
    titulo: Titulo | None = None
    descricao: Descricao | None = None
    categoria: Categoria | None = None
    criticidade: Criticidade | None = None
    local: Local | None = None
    placa: str | None = None

    _placa = field_validator("placa")(_normalizar_placa)

    @model_validator(mode="after")
    def validar_campos(self):
        alterados = self.model_fields_set - {"versao"}
        if not alterados:
            raise ValueError("informe ao menos um campo para alterar")
        # descricao e placa podem ser apagadas (null); os demais campos são obrigatórios.
        for campo in alterados - {"descricao", "placa"}:
            if getattr(self, campo) is None:
                raise ValueError(f"{campo} não pode ser nulo")
        return self

    def alteracoes(self) -> dict:
        return self.model_dump(include=self.model_fields_set - {"versao"})


class VersaoLida(EntradaEstrita):
    versao: Versao


class MudarStatus(EntradaEstrita):
    versao: Versao
    status: StatusIncidente


class AnalistaResumo(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    nome: str


class IncidenteResposta(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    titulo: str
    descricao: str | None
    categoria: Categoria
    criticidade: Criticidade
    status: StatusIncidente
    local: str
    placa: str | None
    responsavel: AnalistaResumo | None
    atualizado_por: AnalistaResumo | None
    versao: int
    criado_em: datetime
    atualizado_em: datetime


class ContagemCriticidade(BaseModel):
    alta: int = 0
    media: int = 0
    baixa: int = 0


class ListaIncidentes(BaseModel):
    itens: list[IncidenteResposta]
    total: int
    contagem_por_criticidade: ContagemCriticidade
