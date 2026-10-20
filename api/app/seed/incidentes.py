"""100 incidentes realistas para demonstrar a triagem (issue #11)."""

import random
from datetime import UTC, datetime, timedelta

from sqlalchemy import func, select, text
from sqlalchemy.orm import Session

from app.core.dominio import Categoria, Criticidade, StatusIncidente, TipoEvento
from app.models import Analista, EventoIncidente, Incidente

TOTAL_INCIDENTES = 100

TITULOS: dict[Categoria, list[str]] = {
    Categoria.ACIDENTE_VEICULO: [
        "Colisão traseira em congestionamento",
        "Tombamento parcial da carreta",
        "Colisão lateral em ultrapassagem",
        "Saída de pista em curva",
        "Engavetamento envolvendo o caminhão",
    ],
    Categoria.ACIDENTE_VITIMAS: [
        "Colisão com vítima presa às ferragens",
        "Atropelamento de pedestre no acostamento",
        "Motorista ferido após capotamento",
        "Colisão frontal com feridos",
    ],
    Categoria.CONDICAO_CLIMATICA: [
        "Neblina densa com visibilidade abaixo de 50 m",
        "Chuva forte com acúmulo de água na pista",
        "Granizo no trecho de serra",
        "Ventos fortes com risco de tombamento",
        "Deslizamento de barreira após temporal",
    ],
    Categoria.PROBLEMA_MECANICO: [
        "Pneu estourado na pista",
        "Superaquecimento do motor",
        "Falha no sistema de freios",
        "Pane elétrica com caminhão parado",
        "Vazamento de óleo hidráulico",
        "Quebra do eixo traseiro",
    ],
    Categoria.BLOQUEIO_PISTA: [
        "Manifestação bloqueando as duas faixas",
        "Obra emergencial com pista em meia faixa",
        "Bloqueio policial após acidente de terceiros",
        "Árvore caída sobre a pista",
        "Carga derramada por outro veículo",
    ],
}

# Probabilidade de cada criticidade por categoria: vítimas tendem a ser alta, clima a média etc.
PESOS_CRITICIDADE: dict[Categoria, tuple[int, int, int]] = {
    Categoria.ACIDENTE_VEICULO: (40, 45, 15),
    Categoria.ACIDENTE_VITIMAS: (90, 10, 0),
    Categoria.CONDICAO_CLIMATICA: (20, 50, 30),
    Categoria.PROBLEMA_MECANICO: (10, 45, 45),
    Categoria.BLOQUEIO_PISTA: (25, 45, 30),
}

TRECHOS = [
    "BR-116, km 212 — Registro/SP",
    "BR-116, km 87 — Guarulhos/SP",
    "BR-381, km 450 — Betim/MG",
    "BR-040, km 10 — Duque de Caxias/RJ",
    "BR-101, km 230 — Itajaí/SC",
    "BR-153, km 501 — Anápolis/GO",
    "BR-060, km 15 — Brasília/DF",
    "BR-050, km 182 — Uberlândia/MG",
    "BR-277, km 98 — Ponta Grossa/PR",
    "BR-364, km 310 — Cuiabá/MT",
    "BR-163, km 734 — Sinop/MT",
    "Rod. Anhanguera (SP-330), km 104 — Campinas/SP",
    "Rod. Régis Bittencourt, km 340 — Miracatu/SP",
    "Rod. Presidente Dutra, km 227 — Arujá/SP",
]

DESCRICOES = [
    "Motorista relatou pelo rádio. Caminhão parado no acostamento.",
    "Informação recebida pelo rastreador e confirmada por ligação.",
    "PRF já acionada. Aguardando atualização no local.",
    "Carga refrigerada; risco de perda se a parada passar de 2 horas.",
    None,
]


def _placa(gerador: random.Random) -> str:
    letras = "ABCDEFGHIJKLMNOPQRSTUVWXYZ"
    return (
        "".join(gerador.choices(letras, k=3))
        + str(gerador.randint(0, 9))
        + gerador.choice(letras)
        + f"{gerador.randint(0, 99):02d}"
    )


def _status(gerador: random.Random) -> StatusIncidente:
    # Maioria aberta: o cenário é uma central sob pressão.
    return gerador.choices(list(StatusIncidente), weights=(60, 20, 8, 12))[0]


def gerar_incidentes(analistas: list[Analista], semente: int = 42) -> list[Incidente]:
    gerador = random.Random(semente)  # determinístico: a demo é sempre a mesma
    agora = datetime.now(UTC)
    incidentes = []
    for _ in range(TOTAL_INCIDENTES):
        categoria = gerador.choice(list(Categoria))
        criticidade = gerador.choices(list(Criticidade), weights=PESOS_CRITICIDADE[categoria])[0]
        status = _status(gerador)
        responsavel = None
        if status != StatusIncidente.ABERTO:
            responsavel = gerador.choice(analistas)
        criado_em = agora - timedelta(minutes=gerador.randint(1, 600))
        incidentes.append(
            Incidente(
                titulo=gerador.choice(TITULOS[categoria]),
                descricao=gerador.choice(DESCRICOES),
                categoria=categoria,
                criticidade=criticidade,
                status=status,
                local=gerador.choice(TRECHOS),
                placa=_placa(gerador),
                responsavel_id=responsavel.id if responsavel else None,
                atualizado_por_id=responsavel.id if responsavel else None,
                versao=1,
                criado_em=criado_em,
                atualizado_em=criado_em,
            )
        )
    return incidentes


def gerar_eventos(incidente: Incidente) -> list[EventoIncidente]:
    """Histórico coerente com o estado do incidente de demonstração.

    Registro (sem autor: chegou pelo rastreador ou pelo rádio) → assumido pelo responsável →
    mudança para Inconclusivo ou Fechado, quando for o caso. As datas ficam entre a criação e
    agora, em ordem.
    """
    criado = incidente.criado_em
    idade = datetime.now(UTC) - criado
    eventos = [
        EventoIncidente(
            tipo=TipoEvento.CRIADO, status_novo=StatusIncidente.ABERTO, criado_em=criado
        )
    ]
    if incidente.responsavel_id is None:
        return eventos
    eventos.append(
        EventoIncidente(
            tipo=TipoEvento.ASSUMIDO,
            analista_id=incidente.responsavel_id,
            status_anterior=StatusIncidente.ABERTO,
            status_novo=StatusIncidente.EM_INVESTIGACAO,
            criado_em=criado + idade * 0.3,
        )
    )
    if incidente.status in (StatusIncidente.INCONCLUSIVO, StatusIncidente.FECHADO):
        eventos.append(
            EventoIncidente(
                tipo=TipoEvento.STATUS,
                analista_id=incidente.responsavel_id,
                status_anterior=StatusIncidente.EM_INVESTIGACAO,
                status_novo=incidente.status,
                criado_em=criado + idade * 0.6,
            )
        )
    return eventos


def semear_incidentes(sessao: Session, analistas: list[Analista], recriar: bool = False) -> int:
    """Cria os 100 incidentes se a tabela estiver vazia. `recriar` apaga tudo antes."""
    if recriar:
        sessao.execute(text("TRUNCATE incidentes, eventos_incidente, ingestoes RESTART IDENTITY"))
    elif sessao.scalar(select(func.count()).select_from(Incidente)):
        return 0
    incidentes = gerar_incidentes(analistas)
    sessao.add_all(incidentes)
    sessao.flush()  # ids para os eventos
    for incidente in incidentes:
        eventos = gerar_eventos(incidente)
        for evento in eventos:
            evento.incidente_id = incidente.id
            sessao.add(evento)
        # Coerente com o histórico: cada alteração depois do registro sobe a versão.
        incidente.versao = len(eventos)
        incidente.atualizado_em = eventos[-1].criado_em
    sessao.commit()
    return len(incidentes)
