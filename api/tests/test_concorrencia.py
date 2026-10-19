"""Dois analistas tentando tratar o mesmo incidente (ADR 0002)."""

from concurrent.futures import ThreadPoolExecutor
from threading import Barrier

from fastapi.testclient import TestClient

from app.services import incidentes as servico
from tests.apoio import acao, criar_incidente


def test_assumir_incidente_ja_assumido_responde_409_com_o_responsavel(
    cliente: TestClient, cliente_bruno: TestClient
):
    incidente = criar_incidente(cliente)
    acao(cliente, incidente, "assumir")

    # Bruno ainda vê a versão 1, de antes de Ana assumir.
    resposta = acao(cliente_bruno, incidente, "assumir")

    assert resposta.status_code == 409
    erro = resposta.json()["erro"]
    assert erro["codigo"] == "ja_assumido"
    assert "Ana Souza" in erro["mensagem"]
    assert erro["atual"]["responsavel"]["nome"] == "Ana Souza"


def test_assumir_de_novo_o_proprio_incidente_nao_altera_nada(cliente: TestClient):
    assumido = acao(cliente, criar_incidente(cliente), "assumir").json()

    resposta = acao(cliente, assumido, "assumir")

    assert resposta.status_code == 200
    assert resposta.json()["versao"] == assumido["versao"]


def test_apenas_o_responsavel_muda_status_edita_ou_remove(
    cliente: TestClient, cliente_bruno: TestClient
):
    incidente = acao(cliente, criar_incidente(cliente), "assumir").json()
    rota = f"/incidentes/{incidente['id']}"

    status = acao(cliente_bruno, incidente, "status", status="fechado")
    edicao = cliente_bruno.patch(rota, json={"versao": incidente["versao"], "titulo": "Outro"})
    liberacao = acao(cliente_bruno, incidente, "liberar")
    remocao = cliente_bruno.delete(rota, params={"versao": incidente["versao"]})

    assert {r.status_code for r in (status, edicao, liberacao, remocao)} == {403}
    assert status.json()["erro"]["codigo"] == "nao_responsavel"
    assert cliente.get(rota).json()["versao"] == incidente["versao"]


def test_depois_de_liberado_outro_analista_pode_assumir(
    cliente: TestClient, cliente_bruno: TestClient
):
    incidente = acao(cliente, criar_incidente(cliente), "assumir").json()
    liberado = acao(cliente, incidente, "liberar").json()

    resposta = acao(cliente_bruno, liberado, "assumir")

    assert resposta.status_code == 200
    assert resposta.json()["responsavel"]["nome"] == "Bruno Lima"


def test_dois_analistas_assumindo_ao_mesmo_tempo_so_um_vence(
    cliente: TestClient, cliente_bruno: TestClient
):
    incidente = criar_incidente(cliente)
    largada = Barrier(2)

    def assumir(cliente_analista: TestClient):
        largada.wait()  # as duas requisições saem juntas
        return acao(cliente_analista, incidente, "assumir")

    with ThreadPoolExecutor(max_workers=2) as executor:
        respostas = list(executor.map(assumir, [cliente, cliente_bruno]))

    assert sorted(r.status_code for r in respostas) == [200, 409]
    vencedor = next(r for r in respostas if r.status_code == 200).json()
    atual = cliente.get(f"/incidentes/{incidente['id']}").json()
    assert atual["responsavel"] == vencedor["responsavel"]
    assert atual["versao"] == 2  # uma única gravação


def test_duas_edicoes_simultaneas_na_mesma_versao_so_uma_e_gravada(
    cliente: TestClient, cliente_bruno: TestClient
):
    incidente = criar_incidente(cliente)
    rota = f"/incidentes/{incidente['id']}"
    largada = Barrier(2)

    def editar(par):
        cliente_analista, titulo = par
        largada.wait()
        return cliente_analista.patch(rota, json={"versao": 1, "titulo": titulo})

    with ThreadPoolExecutor(max_workers=2) as executor:
        respostas = list(
            executor.map(editar, [(cliente, "Versão da Ana"), (cliente_bruno, "Versão do Bruno")])
        )

    assert sorted(r.status_code for r in respostas) == [200, 409]
    gravado = next(r for r in respostas if r.status_code == 200).json()
    assert cliente.get(rota).json()["titulo"] == gravado["titulo"]


# --- A última barreira: o próprio UPDATE ---------------------------------------------
# Os testes com Barrier quase sempre param na checagem de versão feita na leitura. Estes
# desligam essa checagem para forçar o caminho em que a leitura passou, outra gravação entrou
# antes do UPDATE, e só o "WHERE versao = :lida" impede a atualização perdida.


def test_update_com_versao_velha_nao_grava_mesmo_se_a_leitura_passar(
    cliente: TestClient, monkeypatch
):
    incidente = criar_incidente(cliente)
    rota = f"/incidentes/{incidente['id']}"
    cliente.patch(rota, json={"versao": 1, "titulo": "Gravação que chegou primeiro"})
    monkeypatch.setattr(servico, "_exigir_versao_atual", lambda *_: None)

    resposta = cliente.patch(rota, json={"versao": 1, "titulo": "Gravação atrasada"})

    assert resposta.status_code == 409
    assert resposta.json()["erro"]["codigo"] == "conflito_versao"
    atual = cliente.get(rota).json()
    assert atual["titulo"] == "Gravação que chegou primeiro"
    assert atual["versao"] == 2


def test_delete_com_versao_velha_nao_remove_mesmo_se_a_leitura_passar(
    cliente: TestClient, monkeypatch
):
    incidente = criar_incidente(cliente)
    rota = f"/incidentes/{incidente['id']}"
    cliente.patch(rota, json={"versao": 1, "titulo": "Alterado antes da remoção"})
    monkeypatch.setattr(servico, "_exigir_versao_atual", lambda *_: None)

    resposta = cliente.delete(rota, params={"versao": 1})

    assert resposta.status_code == 409
    assert cliente.get(rota).status_code == 200
