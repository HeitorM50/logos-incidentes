from collections import Counter
from datetime import UTC, datetime, timedelta

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.core.dominio import StatusIncidente
from app.models import Incidente
from app.seed.analistas import semear_analistas
from app.seed.incidentes import (
    TOTAL_INCIDENTES,
    _ativos_em_ordem,
    gerar_eventos,
    gerar_incidentes,
    semear_incidentes,
)
from app.services.ciclo_vida import PRAZO_PARA_ASSUMIR_MIN
from app.services.duplicatas import parece_duplicata


def _total(sessao: Session) -> int:
    return sessao.scalar(select(func.count()).select_from(Incidente))


def test_seed_e_idempotente(sessao: Session):
    analistas = semear_analistas(sessao)

    assert semear_incidentes(sessao, analistas) == TOTAL_INCIDENTES
    assert semear_incidentes(sessao, analistas) == 0
    assert len(semear_analistas(sessao)) == 3
    assert _total(sessao) == TOTAL_INCIDENTES


def test_recriar_substitui_os_incidentes(sessao: Session):
    analistas = semear_analistas(sessao)
    semear_incidentes(sessao, analistas)

    assert semear_incidentes(sessao, analistas, recriar=True) == TOTAL_INCIDENTES
    assert _total(sessao) == TOTAL_INCIDENTES


def test_dados_gerados_sao_coerentes_com_o_ciclo_de_vida(sessao: Session):
    analistas = semear_analistas(sessao)
    incidentes = gerar_incidentes(analistas)

    for incidente in incidentes:
        tem_responsavel = incidente.responsavel_id is not None
        # Aberto nunca tem responsável; em investigação sempre tem.
        if incidente.status == StatusIncidente.ABERTO:
            assert not tem_responsavel
        if incidente.status == StatusIncidente.EM_INVESTIGACAO:
            assert tem_responsavel

    # Variedade suficiente para a demo: todas as criticidades e status aparecem.
    assert len(Counter(i.criticidade for i in incidentes)) == 3
    assert len(Counter(i.status for i in incidentes)) == 4


def test_seed_gera_historico_coerente_com_o_estado(sessao: Session):
    from sqlalchemy import select

    from app.models import EventoIncidente, Incidente

    analistas = semear_analistas(sessao)
    semear_incidentes(sessao, analistas)

    for incidente in sessao.scalars(select(Incidente)):
        historico = sessao.scalars(
            select(EventoIncidente)
            .where(EventoIncidente.incidente_id == incidente.id)
            .order_by(EventoIncidente.criado_em)
        ).all()
        assert historico[0].tipo == "criado"
        # O último evento leva ao status atual, e as datas nunca voltam no tempo.
        assert (historico[-1].status_novo or "aberto") == incidente.status
        datas = [e.criado_em for e in historico]
        assert datas == sorted(datas)


def test_poucos_abertos_passam_do_prazo_para_assumir(sessao: Session):
    # Atrasado é a exceção: a demo precisa de alguns, não de quase todos.
    agora = datetime.now(UTC)
    abertos = [
        i for i in gerar_incidentes(semear_analistas(sessao)) if i.status == StatusIncidente.ABERTO
    ]
    atrasados = [
        i
        for i in abertos
        if agora - i.criado_em > timedelta(minutes=PRAZO_PARA_ASSUMIR_MIN[i.criticidade])
    ]

    assert 1 <= len(atrasados) <= len(abertos) * 0.3


def test_a_frota_repete_caminhoes_entre_incidentes(sessao: Session):
    # "Mesma placa" nos detalhes precisa de caminhões com mais de um incidente.
    placas = Counter(i.placa for i in gerar_incidentes(semear_analistas(sessao)))
    assert sum(1 for n in placas.values() if n > 1) >= 5


def test_seed_planta_duas_duplicatas_e_nenhuma_por_acaso(sessao: Session):
    ativos = _ativos_em_ordem(gerar_incidentes(semear_analistas(sessao)))
    pares = [
        (atual, anterior)
        for n, atual in enumerate(ativos)
        for anterior in ativos[:n]
        if parece_duplicata(atual, anterior)
    ]
    assert len(pares) == 2


def test_fechar_e_inconclusivo_do_seed_tem_comentario(sessao: Session):
    # A regra da API exige comentário nesses status; o seed segue a mesma regra.
    for incidente in gerar_incidentes(semear_analistas(sessao)):
        for evento in gerar_eventos(incidente):
            if evento.status_novo in (StatusIncidente.FECHADO, StatusIncidente.INCONCLUSIVO):
                assert evento.comentario
