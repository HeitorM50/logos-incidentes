from datetime import datetime

from pydantic import BaseModel

from app.core.dominio import Categoria, Criticidade, StatusIncidente
from app.schemas.incidente import EventoResposta


class EtapaFunil(BaseModel):
    etapa: str
    quantidade: int


class Metrica(BaseModel):
    """Valor no período e no período anterior, do mesmo tamanho (null: sem dado para medir)."""

    atual: float | None
    anterior: float | None


class PontoSerie(BaseModel):
    inicio: datetime
    total: int
    alta: int


class RelatorioResposta(BaseModel):
    horas: int
    gerado_em: datetime
    funil: list[EtapaFunil]
    recebidos: Metrica
    alta: Metrica
    tempo_ate_assumir_min: Metrica
    tempo_ate_fechar_min: Metrica
    taxa_atraso_pct: Metrica
    serie: list[PontoSerie]


class IncidenteDoRegistro(BaseModel):
    """Uma linha do registro do período: o incidente e os marcos do atendimento."""

    id: int
    titulo: str
    criticidade: Criticidade
    categoria: Categoria
    status: StatusIncidente
    local: str
    placa: str | None
    origem: str
    responsavel: str | None
    motorista: str | None
    criado_em: datetime
    assumido_em: datetime | None
    fechado_em: datetime | None
    comentario_fechamento: str | None


class EventoDoRegistro(EventoResposta):
    incidente_id: int
    incidente_titulo: str = ""


class RegistroDoPeriodo(BaseModel):
    """Para o PDF do relatório: incidentes recebidos ou fechados no período e os eventos dele."""

    horas: int
    inicio: datetime
    gerado_em: datetime
    incidentes: list[IncidenteDoRegistro]
    eventos: list[EventoDoRegistro]
