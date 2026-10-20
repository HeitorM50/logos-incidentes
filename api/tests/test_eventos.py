"""Histórico do incidente: cada alteração grava um evento na mesma transação."""

from fastapi.testclient import TestClient

from app.models import EventoIncidente
from app.services import incidentes as servico
from tests.apoio import acao, criar_incidente


def eventos(cliente: TestClient, incidente: dict) -> list[dict]:
    resposta = cliente.get(f"/incidentes/{incidente['id']}/eventos")
    assert resposta.status_code == 200
    return resposta.json()


def resumo(lista: list[dict]) -> list[tuple]:
    return [
        (
            e["tipo"],
            e["analista"]["nome"] if e["analista"] else None,
            e["status_anterior"],
            e["status_novo"],
        )
        for e in lista
    ]


def test_ciclo_completo_fica_registrado_em_ordem(cliente: TestClient):
    incidente = criar_incidente(cliente)
    incidente = acao(cliente, incidente, "assumir").json()
    incidente = acao(cliente, incidente, "status", status="inconclusivo").json()
    incidente = acao(cliente, incidente, "liberar").json()

    assert resumo(eventos(cliente, incidente)) == [
        ("criado", "Ana Souza", None, "aberto"),
        ("assumido", "Ana Souza", "aberto", "em_investigacao"),
        ("status", "Ana Souza", "em_investigacao", "inconclusivo"),
        ("liberado", "Ana Souza", "inconclusivo", "inconclusivo"),
    ]


def test_edicao_registra_so_os_campos_que_mudaram(cliente: TestClient):
    incidente = criar_incidente(cliente, titulo="Pneu estourado")
    rota = f"/incidentes/{incidente['id']}"

    resposta = cliente.patch(
        rota,
        json={"versao": incidente["versao"], "titulo": "Pneu estourado", "local": "Km 12"},
    )

    assert resposta.status_code == 200
    edicao = eventos(cliente, incidente)[-1]
    assert edicao["tipo"] == "editado"
    assert edicao["campos"] == ["local"]


def test_conflito_409_nao_grava_evento(cliente: TestClient, cliente_bruno: TestClient):
    incidente = criar_incidente(cliente)
    acao(cliente, incidente, "assumir")

    # Bruno usa a versão velha: 409, e nada entra no histórico.
    assert acao(cliente_bruno, incidente, "assumir").status_code == 409

    assert [e["tipo"] for e in eventos(cliente, incidente)] == ["criado", "assumido"]


def test_remover_apaga_o_historico_e_a_rota_responde_404(cliente: TestClient):
    incidente = criar_incidente(cliente)
    removido = cliente.delete(
        f"/incidentes/{incidente['id']}", params={"versao": incidente["versao"]}
    )
    assert removido.status_code == 204

    resposta = cliente.get(f"/incidentes/{incidente['id']}/eventos")

    assert resposta.status_code == 404
    assert resposta.json()["erro"]["codigo"] == "nao_encontrado"


def test_historico_exige_login(cliente: TestClient, cliente_anonimo: TestClient):
    incidente = criar_incidente(cliente)

    resposta = cliente_anonimo.get(f"/incidentes/{incidente['id']}/eventos")

    assert resposta.status_code == 401


# --- Atomicidade: evento e alteração ficam juntos, ou nenhum dos dois --------------------


def test_409_no_proprio_update_nao_deixa_evento(cliente: TestClient, monkeypatch):
    # Desliga a checagem de versão da leitura para chegar ao "WHERE versao = :lida" (a corrida
    # real): o UPDATE não acha a linha, e o evento não pode ficar gravado.
    incidente = criar_incidente(cliente)
    rota = f"/incidentes/{incidente['id']}"
    cliente.patch(rota, json={"versao": 1, "titulo": "Gravação que chegou primeiro"})
    monkeypatch.setattr(servico, "_exigir_versao_atual", lambda *_: None)

    resposta = cliente.patch(rota, json={"versao": 1, "titulo": "Gravação atrasada"})

    assert resposta.status_code == 409
    assert [e["tipo"] for e in eventos(cliente, incidente)] == ["criado", "editado"]


def test_falha_ao_gravar_o_evento_desfaz_a_alteracao(cliente: TestClient, monkeypatch):
    incidente = criar_incidente(cliente)
    # Evento inválido (tipo nulo viola NOT NULL): o commit falha depois do UPDATE.
    with monkeypatch.context() as patch:
        patch.setattr(
            servico, "EventoIncidente", lambda **dados: EventoIncidente(**{**dados, "tipo": None})
        )
        resposta = acao(cliente, incidente, "assumir")

    assert resposta.status_code == 500
    atual = cliente.get(f"/incidentes/{incidente['id']}").json()
    assert atual["versao"] == 1
    assert atual["responsavel"] is None
    assert [e["tipo"] for e in eventos(cliente, incidente)] == ["criado"]


def test_edicao_sem_mudanca_nao_sobe_versao_nem_grava_evento(cliente: TestClient):
    incidente = criar_incidente(cliente, titulo="Pneu estourado")

    resposta = cliente.patch(
        f"/incidentes/{incidente['id']}",
        json={"versao": incidente["versao"], "titulo": "Pneu estourado", "descricao": ""},
    )

    assert resposta.status_code == 200
    assert resposta.json()["versao"] == incidente["versao"]
    assert [e["tipo"] for e in eventos(cliente, incidente)] == ["criado"]


def test_assumir_o_proprio_incidente_nao_grava_evento(cliente: TestClient):
    assumido = acao(cliente, criar_incidente(cliente), "assumir").json()

    acao(cliente, assumido, "assumir")

    assert [e["tipo"] for e in eventos(cliente, assumido)] == ["criado", "assumido"]
