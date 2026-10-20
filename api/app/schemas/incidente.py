import re
from datetime import datetime
from typing import Annotated

from pydantic import (
    AfterValidator,
    BaseModel,
    ConfigDict,
    Field,
    StringConstraints,
    field_validator,
    model_validator,
)

from app.core.dominio import Categoria, Criticidade, PapelAnalista, StatusIncidente, TipoEvento
from app.services.ciclo_vida import EXIGE_COMENTARIO

# Placa no padrão antigo (ABC1234) ou Mercosul (ABC1D23).
PADRAO_PLACA = re.compile(r"^[A-Z]{3}[0-9][A-Z0-9][0-9]{2}$")

# Limites das colunas no Postgres: valores acima deles virariam erro 500 no banco.
MAXIMO_INTEGER = 2**31 - 1
MAXIMO_BIGINT = 2**63 - 1


def _sem_caractere_nulo(valor: str) -> str:
    # O Postgres não aceita \x00 em texto; sem esta checagem o erro estouraria no banco.
    if "\x00" in valor:
        raise ValueError("o texto contém caracteres inválidos")
    return valor


TextoSeguro = AfterValidator(_sem_caractere_nulo)
Titulo = Annotated[
    str, StringConstraints(strip_whitespace=True, min_length=3, max_length=120), TextoSeguro
]
Descricao = Annotated[str, StringConstraints(strip_whitespace=True, max_length=2000), TextoSeguro]
Local = Annotated[
    str, StringConstraints(strip_whitespace=True, min_length=3, max_length=160), TextoSeguro
]
Comentario = Annotated[str, StringConstraints(strip_whitespace=True, max_length=500), TextoSeguro]
MINIMO_COMENTARIO = 3
NomeMotorista = Annotated[
    str, StringConstraints(strip_whitespace=True, min_length=2, max_length=80), TextoSeguro
]
Versao = Annotated[
    int, Field(ge=1, le=MAXIMO_INTEGER, description="Versão do incidente que o cliente leu")
]


def normalizar_placa(valor: str | None) -> str | None:
    if valor is None:
        return None
    placa = valor.replace("-", "").replace(" ", "").upper()
    if not placa:
        return None
    if not PADRAO_PLACA.match(placa):
        raise ValueError("placa inválida; use o formato ABC1234 ou ABC1D23")
    return placa


def normalizar_telefone(valor: str | None) -> str | None:
    """Aceita "(11) 98765-4321", "11987654321" ou "+55 11 98765-4321"; grava +5511987654321."""
    if valor is None:
        return None
    digitos = re.sub(r"\D", "", valor)
    if not digitos:
        return None
    internacional = valor.strip().startswith("+")
    if internacional and not digitos.startswith("55"):
        raise ValueError("telefone inválido; use um número do Brasil (+55)")
    if (internacional or len(digitos) > 11) and digitos.startswith("55"):
        digitos = digitos[2:]
    if len(digitos) not in (10, 11):
        raise ValueError("telefone inválido; use DDD + número, ex.: (11) 98765-4321")
    return f"+55{digitos}"


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
    # Opcionais: sem eles, a API copia o motorista atual do veículo cadastrado com a placa.
    motorista_nome: NomeMotorista | None = None
    motorista_telefone: str | None = None

    _placa = field_validator("placa")(normalizar_placa)
    _telefone = field_validator("motorista_telefone")(normalizar_telefone)


class IncidenteEditar(EntradaEstrita):
    versao: Versao
    titulo: Titulo | None = None
    descricao: Descricao | None = None
    categoria: Categoria | None = None
    criticidade: Criticidade | None = None
    local: Local | None = None
    placa: str | None = None
    motorista_nome: NomeMotorista | None = None
    motorista_telefone: str | None = None

    _placa = field_validator("placa")(normalizar_placa)
    _telefone = field_validator("motorista_telefone")(normalizar_telefone)

    @model_validator(mode="after")
    def validar_campos(self):
        alterados = self.model_fields_set - {"versao"}
        if not alterados:
            raise ValueError("informe ao menos um campo para alterar")
        # Os opcionais podem ser apagados (null); os demais campos são obrigatórios.
        for campo in alterados - {"descricao", "placa", "motorista_nome", "motorista_telefone"}:
            if getattr(self, campo) is None:
                raise ValueError(f"{campo} não pode ser nulo")
        return self

    def alteracoes(self) -> dict:
        return self.model_dump(include=self.model_fields_set - {"versao"})


class VersaoLida(EntradaEstrita):
    versao: Versao


def _comentario_ou_nulo(valor: str | None) -> str | None:
    # Só espaços é o mesmo que não comentar.
    return valor or None


class LiberarIncidente(EntradaEstrita):
    versao: Versao
    comentario: Comentario | None = Field(
        default=None, description="Contexto para o próximo analista (opcional)"
    )

    _comentario = field_validator("comentario")(_comentario_ou_nulo)


class MudarStatus(EntradaEstrita):
    versao: Versao
    status: StatusIncidente
    comentario: Comentario | None = Field(
        default=None,
        description="Obrigatório para fechado e inconclusivo: como resolveu ou por que parou",
    )

    _comentario = field_validator("comentario")(_comentario_ou_nulo)

    @model_validator(mode="after")
    def exigir_comentario(self):
        if self.status in EXIGE_COMENTARIO and len(self.comentario or "") < MINIMO_COMENTARIO:
            raise ValueError(
                f"comentário obrigatório para {self.status.value} "
                f"(mínimo de {MINIMO_COMENTARIO} caracteres)"
            )
        return self


class AnalistaResumo(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    nome: str


class AnalistaComPapel(AnalistaResumo):
    papel: PapelAnalista


class TransferirIncidente(EntradaEstrita):
    versao: Versao
    analista_id: Annotated[int, Field(ge=1, le=MAXIMO_BIGINT, description="Novo responsável")]
    comentario: Comentario | None = None

    _comentario = field_validator("comentario")(_comentario_ou_nulo)


class DispositivoResumo(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    nome: str
    placa: str | None


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
    motorista_nome: str | None = None
    motorista_telefone: str | None = None
    responsavel: AnalistaResumo | None
    atualizado_por: AnalistaResumo | None
    # Caminhão que enviou o incidente pela ingestão; nulo quando um analista o registrou.
    dispositivo: DispositivoResumo | None = None
    # Incidente ativo mais antigo de que este parece cópia (services/duplicatas.py).
    possivel_duplicata_de: int | None = None
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


class EventoResposta(BaseModel):
    """Um item do histórico. `analista` é nulo em eventos sem autor (seed, registros antigos)."""

    model_config = ConfigDict(from_attributes=True)

    id: int
    tipo: TipoEvento
    analista: AnalistaResumo | None
    status_anterior: StatusIncidente | None
    status_novo: StatusIncidente | None
    campos: list[str] | None
    comentario: str | None
    # Transferência: para quem o supervisor passou o incidente.
    responsavel_novo: AnalistaResumo | None = None
    criado_em: datetime
