from fastapi.testclient import TestClient

from app.main import criar_app


def test_documentacao_openapi_disponivel():
    cliente = TestClient(criar_app())

    resposta = cliente.get("/openapi.json")

    assert resposta.status_code == 200
    assert resposta.json()["info"]["title"] == "Logos API"
