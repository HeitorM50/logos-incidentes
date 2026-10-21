"""Onde está cada caminhão da frota de demonstração num instante.

Sem estado: a posição é calculada a partir da placa e do horário. Cada caminhão tem uma rota,
uma velocidade de cruzeiro e um ponto de partida próprios (derivados da placa), e vai e volta na
rota. De tempos em tempos, alguns param por ~45 min (descanso, fila, pane): é o que alimenta a
regra de "parado há muito tempo" da API. Caminhão sem motorista escalado fica no pátio, desligado.
"""

import hashlib
from dataclasses import dataclass
from datetime import datetime

from app.simulacao.rotas import ROTAS, Local, comprimento_km, ponto_na_rota

CICLO_PARADA_MIN = 120
DURACAO_PARADA_MIN = 45
CHANCE_PARADA = 0.12


def _numero(*partes: object) -> float:
    """Número estável em [0, 1) para as mesmas partes (mesmo caminhão, mesmo ciclo)."""
    texto = "|".join(str(p) for p in partes).encode()
    return int.from_bytes(hashlib.sha256(texto).digest()[:8], "big") / 2**64


@dataclass(frozen=True)
class Estado:
    placa: str
    local: Local
    velocidade_kmh: int
    ignicao: bool


def estado_do_caminhao(placa: str, indice: int, agora: datetime, tem_motorista: bool) -> Estado:
    rota = ROTAS[indice % len(ROTAS)]
    extensao = comprimento_km(rota)
    if not tem_motorista:
        return Estado(placa, ponto_na_rota(rota, 0), 0, ignicao=False)

    cruzeiro = 60 + round(_numero(placa, "velocidade") * 30)  # 60 a 90 km/h
    minutos = agora.timestamp() / 60
    ciclo = int(minutos // CICLO_PARADA_MIN)
    no_ciclo = minutos % CICLO_PARADA_MIN
    parado = _numero(placa, "parada", ciclo) < CHANCE_PARADA and no_ciclo < DURACAO_PARADA_MIN

    # Distância andada desde a "época": as paradas descontam o tempo parado de forma aproximada.
    horas = minutos / 60 * (1 - CHANCE_PARADA * DURACAO_PARADA_MIN / CICLO_PARADA_MIN)
    andado = (_numero(placa, "partida") * 2 * extensao + cruzeiro * horas) % (2 * extensao)
    # Vai até o fim e volta.
    na_rota = andado if andado <= extensao else 2 * extensao - andado
    velocidade = (
        0 if parado else max(0, cruzeiro + round((_numero(placa, ciclo, int(minutos)) - 0.5) * 16))
    )
    return Estado(placa, ponto_na_rota(rota, na_rota), velocidade, ignicao=True)
