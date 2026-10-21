"""Simula a central de rastreamento da frota (opção D): telemetria que vira incidente.

A cada passo, calcula onde cada um dos 70 caminhões está (rodovias reais, app/simulacao/), sorteia
os sinais dos sensores (pânico, impacto, temperatura do motor, visibilidade) e envia o lote para
POST /telemetria. Quem decide o que é incidente é a API, pelas regras (app/services/telemetria.py).

    uv run python scripts/simular_frota.py                          # API local, 1 min
    uv run python scripts/simular_frota.py --api https://logos-api-uy7z.onrender.com
    uv run python scripts/simular_frota.py --duracao 300 --intensidade 20   # para o vídeo

O workflow .github/workflows/demo-viva.yml roda este script por 1 min a cada 30 min.
"""

import argparse
import json
import random
import sys
import time
import urllib.error
import urllib.request
from datetime import UTC, datetime
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from app.seed.dispositivos import CHAVE_RASTREADORA  # noqa: E402
from app.seed.frota import gerar_frota  # noqa: E402
from app.simulacao.frota import estado_do_caminhao  # noqa: E402

# Chance de cada sinal anormal por leitura (com --intensidade 1). Com 70 caminhões e 4 passos
# por execução, dá em média pouco mais de um incidente por execução, além das paradas longas.
CHANCE = {"panico": 0.0004, "impacto": 0.0006, "motor_quente": 0.0015, "visibilidade": 0.0015}


def sinais(gerador: random.Random, intensidade: float, velocidade: int) -> dict:
    sorte = lambda regra: gerador.random() < CHANCE[regra] * intensidade  # noqa: E731
    leitura: dict = {
        "temperatura_motor_c": round(gerador.uniform(82, 98), 1),
        "visibilidade_m": gerador.randint(1500, 10000),
    }
    if velocidade and sorte("panico"):
        leitura["panico"] = True
    if velocidade and sorte("impacto"):
        leitura["impacto_g"] = round(gerador.uniform(4.2, 7.5), 1)
    if sorte("motor_quente"):
        leitura["temperatura_motor_c"] = round(gerador.uniform(112, 121), 1)
    if sorte("visibilidade"):
        leitura["visibilidade_m"] = gerador.randint(30, 90)
    return leitura


def enviar(api: str, chave: str, lote: dict) -> tuple[int, dict]:
    pedido = urllib.request.Request(
        f"{api.rstrip('/')}/telemetria",
        data=json.dumps(lote).encode(),
        method="POST",
        headers={"Content-Type": "application/json", "X-Chave-Dispositivo": chave},
    )
    try:
        with urllib.request.urlopen(pedido, timeout=90) as resposta:
            return resposta.status, json.load(resposta)
    except urllib.error.HTTPError as erro:
        return erro.code, json.load(erro)


def main() -> None:
    parser = argparse.ArgumentParser(description="Simula a telemetria da frota")
    parser.add_argument("--api", default="http://localhost:8000")
    parser.add_argument("--chave", default=CHAVE_RASTREADORA)
    parser.add_argument("--duracao", type=int, default=60, help="segundos de simulação")
    parser.add_argument("--intervalo", type=int, default=15, help="segundos entre os envios")
    parser.add_argument(
        "--intensidade", type=float, default=1, help="multiplica a chance dos sinais anormais"
    )
    argumentos = parser.parse_args()

    frota = gerar_frota()  # mesma frota do seed: placa e se há motorista escalado
    gerador = random.Random()
    fim = time.monotonic() + argumentos.duracao
    passo = 0
    while True:
        passo += 1
        agora = datetime.now(UTC)
        leituras = []
        for indice, veiculo in enumerate(frota):
            estado = estado_do_caminhao(
                veiculo.placa, indice, agora, tem_motorista=veiculo.motorista is not None
            )
            leituras.append(
                {
                    "placa": estado.placa,
                    "latitude": estado.local.lat,
                    "longitude": estado.local.lon,
                    "velocidade_kmh": estado.velocidade_kmh,
                    "ignicao": estado.ignicao,
                    "referencia": estado.local.referencia,
                    "registrado_em": agora.isoformat(),
                    "sinais": sinais(gerador, argumentos.intensidade, estado.velocidade_kmh)
                    if estado.ignicao
                    else {},
                }
            )
        status, resposta = enviar(argumentos.api, argumentos.chave, {"leituras": leituras})
        if status != 200:
            raise SystemExit(f"Falhou ({status}): {resposta}")
        novos = ", ".join(
            f"#{i['id']} {i['regra']} ({i['criticidade']}) {i['placa']}"
            for i in resposta["incidentes"]
        )
        print(
            f"Passo {passo}: {resposta['processadas']} leituras"
            + (f" → incidentes: {novos}" if novos else "")
        )
        if time.monotonic() + argumentos.intervalo > fim:
            break
        time.sleep(argumentos.intervalo)


if __name__ == "__main__":
    main()
