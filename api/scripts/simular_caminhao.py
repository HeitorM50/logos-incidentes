"""Simula um caminhão enviando um incidente para a API (ingestão, ADR 0008).

Envia um incidente e depois reenvia o MESMO envio (mesma Idempotency-Key), como faria um
rastreador com a rede oscilando: o segundo envio devolve o mesmo incidente, sem duplicar.
Só usa a biblioteca padrão do Python.

    uv run python scripts/simular_caminhao.py                      # API local
    uv run python scripts/simular_caminhao.py --api https://logos-api-uy7z.onrender.com
    uv run python scripts/simular_caminhao.py --criticidade alta   # dispara o aviso de Alta novo
    uv run python scripts/simular_caminhao.py --frota              # caminhão e trecho sorteados

O modo --frota é o que o job agendado usa (.github/workflows/demo-viva.yml): cada envio vem de
um caminhão da frota de demonstração, num km sorteado, para não parecer sempre o mesmo caminhão
(o que marcaria todos como possível duplicata).
"""

import argparse
import json
import random
import re
import sys
import urllib.error
import urllib.request
import uuid
from pathlib import Path

CHAVE_DEMO = "demo-caminhao-logos-2026"

OCORRENCIAS = [
    ("Tombamento de carreta na serra", "acidente_veiculo", "alta"),
    ("Pneu estourado com caminhão parado no acostamento", "problema_mecanico", "media"),
    ("Neblina densa com visibilidade abaixo de 50 m", "condicao_climatica", "media"),
    ("Bloqueio total por manifestação", "bloqueio_pista", "alta"),
    ("Superaquecimento do motor em subida", "problema_mecanico", "baixa"),
]
TRECHOS = [
    "BR-116, km 212 — Registro/SP",
    "BR-381, km 450 — Betim/MG",
    "BR-101, km 230 — Itajaí/SC",
]


def enviar(api: str, chave: str, idempotencia: str, corpo: dict) -> tuple[int, dict]:
    pedido = urllib.request.Request(
        f"{api.rstrip('/')}/ingestao/incidentes",
        data=json.dumps(corpo).encode(),
        method="POST",
        headers={
            "Content-Type": "application/json",
            "X-Chave-Dispositivo": chave,
            "Idempotency-Key": idempotencia,
        },
    )
    try:
        with urllib.request.urlopen(pedido, timeout=90) as resposta:
            return resposta.status, json.load(resposta)
    except urllib.error.HTTPError as erro:
        return erro.code, json.load(erro)


def main() -> None:
    parser = argparse.ArgumentParser(description="Simula o envio de um caminhão")
    parser.add_argument("--api", default="http://localhost:8000")
    parser.add_argument("--chave", default=CHAVE_DEMO, help="chave do dispositivo")
    parser.add_argument("--criticidade", choices=["alta", "media", "baixa"])
    parser.add_argument(
        "--frota", action="store_true", help="sorteia o caminhão da frota e o km do trecho"
    )
    argumentos = parser.parse_args()

    opcoes = [o for o in OCORRENCIAS if o[2] == argumentos.criticidade] or OCORRENCIAS
    titulo, categoria, criticidade = random.choice(opcoes)
    corpo = {
        "titulo": titulo,
        "descricao": "Enviado pelo rastreador do caminhão.",
        "categoria": categoria,
        "criticidade": criticidade,
        "local": random.choice(TRECHOS),
    }
    if argumentos.frota:
        # Fora do modo padrão: este import precisa do projeto (uv run), não só da stdlib.
        sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
        from app.seed.frota import PLACAS_DA_FROTA
        from app.seed.incidentes import TRECHOS as TRECHOS_DA_FROTA

        corpo["placa"] = random.choice(PLACAS_DA_FROTA)
        trecho = random.choice(TRECHOS_DA_FROTA)
        corpo["local"] = re.sub(r"km \d+", f"km {random.randint(1, 700)}", trecho)
    idempotencia = str(uuid.uuid4())

    status, dados = enviar(argumentos.api, argumentos.chave, idempotencia, corpo)
    if status != 201:
        raise SystemExit(f"Falhou ({status}): {dados}")
    print(f"1º envio → {status} Created: incidente #{dados['id']} ({criticidade}) {titulo}")

    status, repetido = enviar(argumentos.api, argumentos.chave, idempotencia, corpo)
    print(f"Reenvio com a mesma Idempotency-Key → {status}: incidente #{repetido['id']}")
    if repetido.get("id") == dados["id"]:
        print("Sem duplicata: o reenvio devolveu o mesmo incidente.")


if __name__ == "__main__":
    main()
