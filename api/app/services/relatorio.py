"""Relatório da central: o que entrou, o que foi atendido e em quanto tempo.

Tudo sai do histórico (eventos_incidente), o mesmo que a tela de detalhes mostra: o primeiro
"assumido" (ou "transferido") é o início do atendimento; o primeiro status "fechado" é o fim.
O período anterior, do mesmo tamanho, serve de comparação.
"""

from collections import defaultdict
from dataclasses import dataclass
from datetime import UTC, datetime, timedelta

from sqlalchemy import or_, select
from sqlalchemy.orm import Session, joinedload

from app.core.dominio import Criticidade, StatusIncidente, TipoEvento
from app.models import EventoIncidente, Incidente
from app.schemas.relatorio import (
    EtapaFunil,
    EventoDoRegistro,
    IncidenteDoRegistro,
    Metrica,
    PontoSerie,
    RegistroDoPeriodo,
    RelatorioResposta,
)
from app.services.ciclo_vida import PRAZO_PARA_ASSUMIR_MIN

INICIO_DO_ATENDIMENTO = (TipoEvento.ASSUMIDO, TipoEvento.TRANSFERIDO)


@dataclass
class _Estatisticas:
    recebidos: int = 0
    alta: int = 0
    assumidos: int = 0
    assumidos_no_prazo: int = 0
    fechados: int = 0
    atrasados: int = 0
    soma_assumir_min: float = 0
    soma_fechar_min: float = 0

    def media_assumir(self) -> float | None:
        return round(self.soma_assumir_min / self.assumidos, 1) if self.assumidos else None

    def media_fechar(self) -> float | None:
        return round(self.soma_fechar_min / self.fechados, 1) if self.fechados else None

    def taxa_atraso(self) -> float | None:
        return round(100 * self.atrasados / self.recebidos, 1) if self.recebidos else None


def _minutos(inicio: datetime, fim: datetime) -> float:
    return max(0.0, (fim - inicio).total_seconds() / 60)


def gerar(sessao: Session, horas: int, agora: datetime | None = None) -> RelatorioResposta:
    agora = agora or datetime.now(UTC)
    inicio = agora - timedelta(hours=horas)
    inicio_anterior = inicio - timedelta(hours=horas)

    incidentes = sessao.execute(
        select(Incidente.id, Incidente.criticidade, Incidente.status, Incidente.criado_em).where(
            Incidente.criado_em >= inicio_anterior, Incidente.criado_em <= agora
        )
    ).all()
    ids = [i.id for i in incidentes]
    assumido_em: dict[int, datetime] = {}
    fechado_em: dict[int, datetime] = {}
    if ids:
        eventos = sessao.execute(
            select(
                EventoIncidente.incidente_id,
                EventoIncidente.tipo,
                EventoIncidente.status_novo,
                EventoIncidente.criado_em,
            )
            .where(EventoIncidente.incidente_id.in_(ids))
            .order_by(EventoIncidente.criado_em)
        ).all()
        for e in eventos:
            if e.tipo in INICIO_DO_ATENDIMENTO:
                assumido_em.setdefault(e.incidente_id, e.criado_em)
            if e.status_novo == StatusIncidente.FECHADO:
                fechado_em.setdefault(e.incidente_id, e.criado_em)

    atual, anterior = _Estatisticas(), _Estatisticas()
    # Série dos recebidos: no máximo 24 pontos (de hora em hora até 24 h; em 7 dias, de 7 em 7 h).
    passo = timedelta(hours=max(1, horas // 24))
    pontos = int(timedelta(hours=horas) / passo)
    serie_total: dict[int, int] = defaultdict(int)
    serie_alta: dict[int, int] = defaultdict(int)

    for incidente in incidentes:
        estat = atual if incidente.criado_em >= inicio else anterior
        prazo = PRAZO_PARA_ASSUMIR_MIN[incidente.criticidade]
        estat.recebidos += 1
        estat.alta += incidente.criticidade == Criticidade.ALTA
        assumiu = assumido_em.get(incidente.id)
        if assumiu:
            espera = _minutos(incidente.criado_em, assumiu)
            estat.assumidos += 1
            estat.soma_assumir_min += espera
            estat.assumidos_no_prazo += espera <= prazo
            estat.atrasados += espera > prazo
        elif incidente.status != StatusIncidente.FECHADO:
            estat.atrasados += _minutos(incidente.criado_em, agora) > prazo
        fechou = fechado_em.get(incidente.id)
        if fechou:
            estat.fechados += 1
            estat.soma_fechar_min += _minutos(incidente.criado_em, fechou)
        if estat is atual:
            posicao = min(pontos - 1, int((incidente.criado_em - inicio) / passo))
            serie_total[posicao] += 1
            serie_alta[posicao] += incidente.criticidade == Criticidade.ALTA

    return RelatorioResposta(
        horas=horas,
        gerado_em=agora,
        funil=[
            EtapaFunil(etapa="Recebidos", quantidade=atual.recebidos),
            EtapaFunil(etapa="Assumidos", quantidade=atual.assumidos),
            EtapaFunil(etapa="Assumidos no prazo", quantidade=atual.assumidos_no_prazo),
            EtapaFunil(etapa="Fechados", quantidade=atual.fechados),
        ],
        recebidos=Metrica(atual=atual.recebidos, anterior=anterior.recebidos),
        alta=Metrica(atual=atual.alta, anterior=anterior.alta),
        tempo_ate_assumir_min=Metrica(
            atual=atual.media_assumir(), anterior=anterior.media_assumir()
        ),
        tempo_ate_fechar_min=Metrica(atual=atual.media_fechar(), anterior=anterior.media_fechar()),
        taxa_atraso_pct=Metrica(atual=atual.taxa_atraso(), anterior=anterior.taxa_atraso()),
        serie=[
            PontoSerie(inicio=inicio + passo * n, total=serie_total[n], alta=serie_alta[n])
            for n in range(pontos)
        ],
    )


def registro(sessao: Session, horas: int, agora: datetime | None = None) -> RegistroDoPeriodo:
    """Incidentes recebidos OU fechados no período (um fechado hoje pode ter chegado ontem) e
    a linha do tempo de todos os eventos do período, para o PDF do relatório."""
    agora = agora or datetime.now(UTC)
    inicio = agora - timedelta(hours=horas)

    eventos = sessao.scalars(
        select(EventoIncidente)
        .options(joinedload(EventoIncidente.analista), joinedload(EventoIncidente.responsavel_novo))
        .where(EventoIncidente.criado_em >= inicio, EventoIncidente.criado_em <= agora)
        .order_by(EventoIncidente.criado_em, EventoIncidente.id)
    ).all()
    fechados_no_periodo = {
        e.incidente_id for e in eventos if e.status_novo == StatusIncidente.FECHADO
    }
    incidentes = sessao.scalars(
        select(Incidente)
        .options(joinedload(Incidente.responsavel), joinedload(Incidente.dispositivo))
        .where(
            or_(
                Incidente.criado_em.between(inicio, agora),
                Incidente.id.in_(fechados_no_periodo or {0}),
            )
        )
        .order_by(Incidente.criado_em, Incidente.id)
    ).all()

    # Marcos de cada incidente, do histórico completo (o assumir pode ser de antes do período).
    ids = [i.id for i in incidentes]
    marcos = sessao.execute(
        select(
            EventoIncidente.incidente_id,
            EventoIncidente.tipo,
            EventoIncidente.status_novo,
            EventoIncidente.comentario,
            EventoIncidente.criado_em,
        )
        .where(EventoIncidente.incidente_id.in_(ids or [0]))
        .order_by(EventoIncidente.criado_em)
    ).all()
    assumido_em: dict[int, datetime] = {}
    fechamento: dict[int, tuple[datetime, str | None]] = {}
    for m in marcos:
        if m.tipo in INICIO_DO_ATENDIMENTO:
            assumido_em.setdefault(m.incidente_id, m.criado_em)
        if m.status_novo == StatusIncidente.FECHADO:
            fechamento.setdefault(m.incidente_id, (m.criado_em, m.comentario))

    # Título de cada incidente citado na linha do tempo (alguns chegaram antes do período).
    titulos = dict(
        sessao.execute(
            select(Incidente.id, Incidente.titulo).where(
                Incidente.id.in_({e.incidente_id for e in eventos} or {0})
            )
        ).all()
    )

    return RegistroDoPeriodo(
        horas=horas,
        inicio=inicio,
        gerado_em=agora,
        incidentes=[
            IncidenteDoRegistro(
                id=i.id,
                titulo=i.titulo,
                criticidade=i.criticidade,
                categoria=i.categoria,
                status=i.status,
                local=i.local,
                placa=i.placa,
                origem=i.dispositivo.nome if i.dispositivo else "Central",
                responsavel=i.responsavel.nome if i.responsavel else None,
                motorista=i.motorista_nome,
                criado_em=i.criado_em,
                assumido_em=assumido_em.get(i.id),
                fechado_em=fechamento[i.id][0] if i.id in fechamento else None,
                comentario_fechamento=fechamento[i.id][1] if i.id in fechamento else None,
            )
            for i in incidentes
        ],
        eventos=[
            EventoDoRegistro.model_validate(e).model_copy(
                update={"incidente_titulo": titulos.get(e.incidente_id, "")}
            )
            for e in eventos
        ],
    )
