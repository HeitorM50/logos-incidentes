"""Movimento da frota simulada: determinístico, dentro do Brasil e coerente com a escala."""

from datetime import UTC, datetime, timedelta

from app.seed.frota import PLACAS_DA_FROTA
from app.simulacao.frota import estado_do_caminhao
from app.simulacao.rotas import ROTAS, comprimento_km, ponto_na_rota

AGORA = datetime(2026, 10, 21, 12, 0, tzinfo=UTC)


def test_mesma_placa_e_horario_dao_a_mesma_posicao():
    a = estado_do_caminhao("RTA4E21", 0, AGORA, tem_motorista=True)
    b = estado_do_caminhao("RTA4E21", 0, AGORA, tem_motorista=True)
    assert a == b


def test_caminhoes_ficam_no_brasil_e_andam_com_o_tempo():
    for indice, placa in enumerate(PLACAS_DA_FROTA):
        estado = estado_do_caminhao(placa, indice, AGORA, tem_motorista=True)
        assert -34 < estado.local.lat < 6 and -74 < estado.local.lon < -34
        assert 0 <= estado.velocidade_kmh <= 100
    andando = [
        placa
        for indice, placa in enumerate(PLACAS_DA_FROTA)
        if estado_do_caminhao(placa, indice, AGORA, True).local
        != estado_do_caminhao(placa, indice, AGORA + timedelta(minutes=10), True).local
    ]
    assert len(andando) > len(PLACAS_DA_FROTA) / 2


def test_sem_motorista_fica_no_patio_desligado():
    estado = estado_do_caminhao("RTA4E21", 0, AGORA, tem_motorista=False)
    assert (estado.velocidade_kmh, estado.ignicao) == (0, False)


def test_referencia_diz_rodovia_km_e_cidade():
    rota = ROTAS[0]
    local = ponto_na_rota(rota, comprimento_km(rota) / 2)
    assert local.referencia.startswith(f"{rota.rodovia}, km ")
    assert "—" in local.referencia
