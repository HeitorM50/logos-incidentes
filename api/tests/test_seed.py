from collections import Counter

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.core.dominio import StatusIncidente
from app.models import Incidente
from app.seed.analistas import semear_analistas
from app.seed.incidentes import TOTAL_INCIDENTES, gerar_incidentes, semear_incidentes


def _total(sessao: Session) -> int:
    return sessao.scalar(select(func.count()).select_from(Incidente))


def test_seed_e_idempotente(sessao: Session):
    analistas = semear_analistas(sessao)

    assert semear_incidentes(sessao, analistas) == TOTAL_INCIDENTES
    assert semear_incidentes(sessao, analistas) == 0
    assert len(semear_analistas(sessao)) == 2
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
