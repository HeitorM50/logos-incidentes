from datetime import datetime

from pydantic import BaseModel


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
