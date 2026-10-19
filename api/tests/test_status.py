from fastapi.testclient import TestClient

from tests.apoio import acao, criar_incidente


def test_mudar_status_sem_assumir_responde_422(cliente: TestClient):
    incidente = criar_incidente(cliente)

    resposta = acao(cliente, incidente, "status", status="fechado")

    assert resposta.status_code == 422
    assert resposta.json()["erro"]["codigo"] == "transicao_invalida"


def test_fluxo_completo_assumir_inconclusivo_e_fechar(cliente: TestClient):
    incidente = acao(cliente, criar_incidente(cliente), "assumir").json()
    assert incidente["status"] == "em_investigacao"

    incidente = acao(cliente, incidente, "status", status="inconclusivo").json()
    assert incidente["status"] == "inconclusivo"

    incidente = acao(cliente, incidente, "status", status="fechado").json()
    assert incidente["status"] == "fechado"
    assert incidente["versao"] == 4


def test_transicao_proibida_responde_422_e_nao_grava(cliente: TestClient):
    incidente = acao(cliente, criar_incidente(cliente), "assumir").json()

    resposta = acao(cliente, incidente, "status", status="aberto")

    assert resposta.status_code == 422
    assert resposta.json()["erro"]["codigo"] == "transicao_invalida"
    atual = cliente.get(f"/incidentes/{incidente['id']}").json()
    assert atual["status"] == "em_investigacao"
    assert atual["versao"] == incidente["versao"]


def test_status_invalido_responde_422_de_validacao(cliente: TestClient):
    incidente = acao(cliente, criar_incidente(cliente), "assumir").json()

    resposta = acao(cliente, incidente, "status", status="resolvido")

    assert resposta.json()["erro"]["codigo"] == "validacao"


def test_incidente_fechado_nao_aceita_alteracoes(cliente: TestClient):
    incidente = acao(cliente, criar_incidente(cliente), "assumir").json()
    fechado = acao(cliente, incidente, "status", status="fechado").json()

    edicao = cliente.patch(
        f"/incidentes/{fechado['id']}", json={"versao": fechado["versao"], "titulo": "Novo"}
    )
    liberacao = acao(cliente, fechado, "liberar")

    assert edicao.status_code == liberacao.status_code == 422
    assert edicao.json()["erro"]["codigo"] == "incidente_fechado"


def test_liberar_devolve_o_incidente_para_aberto(cliente: TestClient):
    incidente = acao(cliente, criar_incidente(cliente), "assumir").json()

    liberado = acao(cliente, incidente, "liberar").json()

    assert liberado["status"] == "aberto"
    assert liberado["responsavel"] is None
