from fastapi.testclient import TestClient


def criar_incidente(cliente: TestClient, **sobrescrever) -> dict:
    corpo = {
        "titulo": "Pneu estourado na pista",
        "categoria": "problema_mecanico",
        "criticidade": "media",
        "local": "BR-116, km 212 — Registro/SP",
    } | sobrescrever
    resposta = cliente.post("/incidentes", json=corpo)
    assert resposta.status_code == 201, resposta.text
    return resposta.json()


def acao(cliente: TestClient, incidente: dict, nome: str, **corpo):
    return cliente.post(
        f"/incidentes/{incidente['id']}/{nome}", json={"versao": incidente["versao"]} | corpo
    )
