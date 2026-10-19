"""Regras puras da máquina de estados — rodam sem banco."""

import pytest

from app.core.dominio import StatusIncidente as S
from app.services.ciclo_vida import PODE_ASSUMIR, status_apos_liberar, transicao_permitida

PERMITIDAS = {
    (S.EM_INVESTIGACAO, S.INCONCLUSIVO),
    (S.EM_INVESTIGACAO, S.FECHADO),
    (S.INCONCLUSIVO, S.EM_INVESTIGACAO),
    (S.INCONCLUSIVO, S.FECHADO),
}


@pytest.mark.parametrize("atual", list(S))
@pytest.mark.parametrize("novo", list(S))
def test_tabela_de_transicoes(atual: S, novo: S):
    assert transicao_permitida(atual, novo) == ((atual, novo) in PERMITIDAS)


def test_fechado_e_estado_final():
    assert not any(transicao_permitida(S.FECHADO, novo) for novo in S)
    assert S.FECHADO not in PODE_ASSUMIR


def test_liberar_devolve_investigacao_para_a_fila():
    assert status_apos_liberar(S.EM_INVESTIGACAO) == S.ABERTO
    assert status_apos_liberar(S.INCONCLUSIVO) == S.INCONCLUSIVO
