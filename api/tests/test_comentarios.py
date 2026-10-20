"""Comentário ao fechar, marcar inconclusivo e liberar: obrigatório nos dois primeiros."""

import pytest
from fastapi.testclient import TestClient

from tests.apoio import acao, criar_incidente


def assumido(cliente: TestClient) -> dict:
    return acao(cliente, criar_incidente(cliente), "assumir").json()


def ultimo_evento(cliente: TestClient, incidente: dict) -> dict:
    return cliente.get(f"/incidentes/{incidente['id']}/eventos").json()[-1]


@pytest.mark.parametrize("status", ["fechado", "inconclusivo"])
@pytest.mark.parametrize("comentario", [None, "", "   ", "ok"])
def test_fechar_ou_inconclusivo_sem_comentario_responde_422(
    cliente: TestClient, status: str, comentario: str | None
):
    incidente = assumido(cliente)
    corpo = {"versao": incidente["versao"], "status": status}
    if comentario is not None:
        corpo["comentario"] = comentario

    resposta = cliente.post(f"/incidentes/{incidente['id']}/status", json=corpo)

    assert resposta.status_code == 422
    assert "comentário obrigatório" in resposta.text
    # Nada mudou: nem o status, nem a versão.
    atual = cliente.get(f"/incidentes/{incidente['id']}").json()
    assert (atual["status"], atual["versao"]) == ("em_investigacao", incidente["versao"])


def test_fechar_grava_o_comentario_no_historico(cliente: TestClient):
    incidente = assumido(cliente)

    resposta = acao(
        cliente, incidente, "status", status="fechado", comentario="  Guincho removeu às 14h  "
    )

    assert resposta.status_code == 200
    evento = ultimo_evento(cliente, incidente)
    assert (evento["status_novo"], evento["comentario"]) == ("fechado", "Guincho removeu às 14h")


def test_voltar_para_em_investigacao_nao_exige_comentario(cliente: TestClient):
    incidente = acao(cliente, assumido(cliente), "status", status="inconclusivo").json()

    resposta = acao(cliente, incidente, "status", status="em_investigacao")

    assert resposta.status_code == 200
    assert ultimo_evento(cliente, incidente)["comentario"] is None


def test_liberar_aceita_comentario_opcional(cliente: TestClient):
    sem = acao(cliente, assumido(cliente), "liberar")
    assert sem.status_code == 200
    assert ultimo_evento(cliente, sem.json())["comentario"] is None

    com = acao(cliente, assumido(cliente), "liberar", comentario="Motorista não atende")
    assert com.status_code == 200
    assert ultimo_evento(cliente, com.json())["comentario"] == "Motorista não atende"


def test_comentario_longo_demais_responde_422(cliente: TestClient):
    incidente = assumido(cliente)
    resposta = acao(cliente, incidente, "liberar", comentario="x" * 501)
    assert resposta.status_code == 422
