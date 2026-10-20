"""Paridade das regras: o JSON que o front usa é igual às regras do código da API."""

import json
from pathlib import Path

from fastapi.testclient import TestClient

from app.regras import regras

ARQUIVO_DO_FRONT = Path(__file__).resolve().parents[2] / "web" / "src" / "api" / "regras.json"


def test_o_json_do_front_e_igual_as_regras_da_api():
    # Mudou uma regra na API (transição, limite de campo, placa)? Gere o JSON de novo:
    #   uv run python -m app.regras > ../web/src/api/regras.json
    assert json.loads(ARQUIVO_DO_FRONT.read_text(encoding="utf-8")) == regras(), (
        "web/src/api/regras.json está desatualizado em relação às regras da API"
    )


def test_rota_publica_devolve_as_mesmas_regras(cliente_anonimo: TestClient):
    resposta = cliente_anonimo.get("/regras")
    assert resposta.status_code == 200
    assert resposta.json() == regras()


def test_regras_derivadas_do_codigo():
    atual = regras()
    assert atual["status_final"] == ["fechado"]
    assert atual["status_apos_liberar"]["em_investigacao"] == "aberto"
    assert atual["limites"]["titulo"] == {"min": 3, "max": 120}
    assert "fechado" not in atual["transicoes_do_responsavel"]
