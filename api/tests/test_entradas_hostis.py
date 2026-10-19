"""Entradas que passavam pelo Pydantic e quebravam no banco ou no bcrypt (revisão do dia 1)."""

import pytest
from fastapi.testclient import TestClient

from tests.apoio import criar_incidente


def test_senha_acima_de_72_bytes_nao_derruba_o_login(cliente_anonimo: TestClient, analistas):
    resposta = cliente_anonimo.post("/auth/login", json={"usuario": "ana", "senha": "a" * 100})

    assert resposta.status_code == 422
    assert resposta.json()["erro"]["campos"][0]["campo"] == "senha"


@pytest.mark.parametrize("campo", ["titulo", "descricao", "local"])
def test_caractere_nulo_em_texto_responde_422(cliente: TestClient, campo: str):
    corpo = {
        "titulo": "Bloqueio na pista",
        "categoria": "bloqueio_pista",
        "criticidade": "alta",
        "local": "BR-040, km 10",
    } | {campo: "ab\u0000cd"}

    resposta = cliente.post("/incidentes", json=corpo)

    assert resposta.status_code == 422
    assert resposta.json()["erro"]["campos"][0]["campo"] == campo


def test_id_fora_do_intervalo_do_bigint_responde_422(cliente: TestClient):
    resposta = cliente.get("/incidentes/99999999999999999999")

    assert resposta.status_code == 422


def test_versao_fora_do_intervalo_responde_422(cliente: TestClient):
    incidente = criar_incidente(cliente)

    resposta = cliente.patch(
        f"/incidentes/{incidente['id']}", json={"versao": 2**40, "titulo": "Novo título"}
    )

    assert resposta.status_code == 422


def test_rota_inexistente_usa_o_formato_de_erro_do_contrato(cliente_anonimo: TestClient):
    resposta = cliente_anonimo.get("/rota-que-nao-existe")

    assert resposta.status_code == 404
    assert resposta.json()["erro"]["codigo"] == "nao_encontrado"


def test_metodo_nao_permitido_usa_o_formato_de_erro(cliente_anonimo: TestClient):
    resposta = cliente_anonimo.put("/health")

    assert resposta.status_code == 405
    assert resposta.json()["erro"]["codigo"] == "metodo_nao_permitido"


def test_erro_inesperado_responde_500_generico_com_cabecalho_cors(app_teste):
    @app_teste.get("/teste-erro-inesperado")
    def rota_com_bug():
        raise RuntimeError("detalhe interno que não pode vazar")

    resposta = TestClient(app_teste).get(
        "/teste-erro-inesperado", headers={"Origin": "http://localhost:5173"}
    )

    assert resposta.status_code == 500
    assert resposta.json()["erro"]["codigo"] == "erro_interno"
    assert "detalhe interno" not in resposta.text
    # Sem este cabeçalho o navegador esconderia a resposta e o front veria "erro de rede".
    assert resposta.headers["access-control-allow-origin"] == "http://localhost:5173"
