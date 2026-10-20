"""Supervisor transfere o incidente para outro analista (controle de versão e histórico)."""

from fastapi.testclient import TestClient

from app.models import Analista
from tests.apoio import acao, criar_incidente


def transferir(cliente: TestClient, incidente: dict, destino: Analista, **corpo):
    return acao(cliente, incidente, "transferir", analista_id=destino.id, **corpo)


def test_supervisor_transfere_e_o_historico_registra(
    cliente: TestClient, cliente_carla: TestClient, analistas: dict[str, Analista]
):
    incidente = acao(cliente, criar_incidente(cliente), "assumir").json()

    resposta = transferir(
        cliente_carla, incidente, analistas["bruno"], comentario="Ana saiu do turno"
    )

    assert resposta.status_code == 200
    transferido = resposta.json()
    assert transferido["responsavel"]["nome"] == "Bruno Lima"
    assert transferido["versao"] == incidente["versao"] + 1
    evento = cliente.get(f"/incidentes/{incidente['id']}/eventos").json()[-1]
    assert evento["tipo"] == "transferido"
    assert evento["analista"]["nome"] == "Carla Mendes"
    assert evento["responsavel_novo"]["nome"] == "Bruno Lima"
    assert evento["comentario"] == "Ana saiu do turno"


def test_aberto_transferido_vai_para_em_investigacao(
    cliente: TestClient, cliente_carla: TestClient, analistas: dict[str, Analista]
):
    incidente = criar_incidente(cliente)
    transferido = transferir(cliente_carla, incidente, analistas["ana"]).json()
    assert (transferido["status"], transferido["responsavel"]["nome"]) == (
        "em_investigacao",
        "Ana Souza",
    )


def test_analista_comum_nao_transfere(cliente: TestClient, analistas: dict[str, Analista]):
    incidente = criar_incidente(cliente)
    resposta = transferir(cliente, incidente, analistas["bruno"])
    assert resposta.status_code == 403
    assert resposta.json()["erro"]["codigo"] == "so_supervisor"


def test_transferir_com_versao_antiga_responde_409(
    cliente: TestClient, cliente_carla: TestClient, analistas: dict[str, Analista]
):
    incidente = criar_incidente(cliente)
    acao(cliente, incidente, "assumir")

    resposta = transferir(cliente_carla, incidente, analistas["bruno"])

    assert resposta.status_code == 409
    assert resposta.json()["erro"]["atual"]["responsavel"]["nome"] == "Ana Souza"


def test_destino_invalido_ou_ja_responsavel_responde_422(
    cliente: TestClient, cliente_carla: TestClient, analistas: dict[str, Analista]
):
    incidente = acao(cliente, criar_incidente(cliente), "assumir").json()
    assert transferir(cliente_carla, incidente, analistas["ana"]).status_code == 422
    inexistente = acao(cliente_carla, incidente, "transferir", analista_id=999_999)
    assert inexistente.status_code == 422


def test_lista_de_analistas_traz_o_papel(cliente: TestClient, analistas: dict[str, Analista]):
    lista = cliente.get("/analistas").json()
    assert [(a["nome"], a["papel"]) for a in lista] == [
        ("Ana Souza", "analista"),
        ("Bruno Lima", "analista"),
        ("Carla Mendes", "supervisor"),
    ]
