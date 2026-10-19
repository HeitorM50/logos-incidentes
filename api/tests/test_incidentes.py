from fastapi.testclient import TestClient
from sqlalchemy import update
from sqlalchemy.orm import Session

from app.models import Incidente
from tests.apoio import criar_incidente as criar


def payload(**sobrescrever) -> dict:
    base = {
        "titulo": "Pneu estourado na pista",
        "categoria": "problema_mecanico",
        "criticidade": "media",
        "local": "BR-116, km 212 — Registro/SP",
    }
    return base | sobrescrever


# --- Criação e validação -------------------------------------------------------------


def test_criar_incidente_comeca_aberto_na_versao_1(cliente: TestClient):
    incidente = criar(cliente, placa="rta-4e21", descricao="  Caminhão parado no acostamento ")

    assert incidente["status"] == "aberto"
    assert incidente["versao"] == 1
    assert incidente["placa"] == "RTA4E21"
    assert incidente["descricao"] == "Caminhão parado no acostamento"
    assert incidente["responsavel"] is None


def test_criar_com_categoria_inexistente_responde_422_com_o_campo(cliente: TestClient):
    resposta = cliente.post("/incidentes", json=payload(categoria="meteoro"))

    assert resposta.status_code == 422
    erro = resposta.json()["erro"]
    assert erro["codigo"] == "validacao"
    assert erro["campos"][0]["campo"] == "categoria"


def test_criar_rejeita_campo_desconhecido(cliente: TestClient):
    resposta = cliente.post("/incidentes", json=payload(status="fechado"))

    assert resposta.status_code == 422


def test_criar_rejeita_titulo_curto_e_placa_invalida(cliente: TestClient):
    resposta = cliente.post("/incidentes", json=payload(titulo="  a ", placa="123"))

    campos = {c["campo"] for c in resposta.json()["erro"]["campos"]}
    assert resposta.status_code == 422
    assert campos == {"titulo", "placa"}


def test_criar_com_corpo_que_nao_e_json_responde_422(cliente: TestClient):
    resposta = cliente.post(
        "/incidentes", content="isto não é json", headers={"Content-Type": "application/json"}
    )

    assert resposta.status_code == 422


# --- Leitura -------------------------------------------------------------------------


def test_obter_incidente_inexistente_responde_404(cliente: TestClient):
    resposta = cliente.get("/incidentes/999")

    assert resposta.status_code == 404
    assert resposta.json()["erro"]["codigo"] == "nao_encontrado"


def test_listar_ordena_por_criticidade_e_tempo_aberto(cliente: TestClient, sessao: Session):
    baixa = criar(cliente, criticidade="baixa")
    alta_antiga = criar(cliente, criticidade="alta")
    media = criar(cliente, criticidade="media")
    alta_recente = criar(cliente, criticidade="alta")
    alta_fechada = criar(cliente, criticidade="alta")
    sessao.execute(
        update(Incidente).where(Incidente.id == alta_fechada["id"]).values(status="fechado")
    )
    sessao.commit()

    ids = [i["id"] for i in cliente.get("/incidentes").json()["itens"]]

    assert ids == [
        alta_antiga["id"],
        alta_recente["id"],
        media["id"],
        baixa["id"],
        alta_fechada["id"],
    ]


def test_filtro_de_criticidade_nao_altera_os_contadores(cliente: TestClient):
    criar(cliente, criticidade="alta")
    criar(cliente, criticidade="alta", categoria="bloqueio_pista")
    criar(cliente, criticidade="baixa")

    corpo = cliente.get("/incidentes", params={"criticidade": "alta"}).json()

    assert corpo["total"] == 2
    assert {i["criticidade"] for i in corpo["itens"]} == {"alta"}
    assert corpo["contagem_por_criticidade"] == {"alta": 2, "media": 0, "baixa": 1}


def test_filtros_combinados_de_categoria_e_criticidade(cliente: TestClient):
    criar(cliente, criticidade="alta", categoria="bloqueio_pista")
    criar(cliente, criticidade="alta", categoria="acidente_vitimas")
    criar(cliente, criticidade="media", categoria="acidente_vitimas")

    corpo = cliente.get(
        "/incidentes",
        params={"categoria": ["acidente_vitimas", "bloqueio_pista"], "criticidade": "alta"},
    ).json()

    assert corpo["total"] == 2
    assert corpo["contagem_por_criticidade"] == {"alta": 2, "media": 1, "baixa": 0}


def test_filtro_com_valor_invalido_responde_422(cliente: TestClient):
    resposta = cliente.get("/incidentes", params={"criticidade": "urgentissima"})

    assert resposta.status_code == 422


# --- Edição e remoção ----------------------------------------------------------------


def test_editar_incrementa_a_versao(cliente: TestClient):
    incidente = criar(cliente)

    resposta = cliente.patch(
        f"/incidentes/{incidente['id']}", json={"versao": 1, "criticidade": "alta"}
    )

    assert resposta.status_code == 200
    assert resposta.json()["criticidade"] == "alta"
    assert resposta.json()["versao"] == 2


def test_editar_com_versao_desatualizada_responde_409_com_estado_atual(cliente: TestClient):
    incidente = criar(cliente)
    cliente.patch(f"/incidentes/{incidente['id']}", json={"versao": 1, "titulo": "Primeira"})

    resposta = cliente.patch(
        f"/incidentes/{incidente['id']}", json={"versao": 1, "titulo": "Segunda"}
    )

    assert resposta.status_code == 409
    erro = resposta.json()["erro"]
    assert erro["codigo"] == "conflito_versao"
    assert erro["atual"]["titulo"] == "Primeira"
    assert erro["atual"]["versao"] == 2


def test_editar_sem_campos_ou_com_titulo_nulo_responde_422(cliente: TestClient):
    incidente = criar(cliente)
    rota = f"/incidentes/{incidente['id']}"

    assert cliente.patch(rota, json={"versao": 1}).status_code == 422
    assert cliente.patch(rota, json={"versao": 1, "titulo": None}).status_code == 422


def test_editar_permite_apagar_campos_opcionais(cliente: TestClient):
    incidente = criar(cliente, placa="ABC1234", descricao="detalhe")

    resposta = cliente.patch(
        f"/incidentes/{incidente['id']}", json={"versao": 1, "placa": None, "descricao": None}
    )

    assert resposta.json()["placa"] is None
    assert resposta.json()["descricao"] is None


def test_remover_incidente(cliente: TestClient):
    incidente = criar(cliente)
    rota = f"/incidentes/{incidente['id']}"

    assert cliente.delete(rota, params={"versao": 1}).status_code == 204
    assert cliente.get(rota).status_code == 404


def test_remover_com_versao_desatualizada_responde_409(cliente: TestClient):
    incidente = criar(cliente)
    rota = f"/incidentes/{incidente['id']}"
    cliente.patch(rota, json={"versao": 1, "titulo": "Alterado antes"})

    resposta = cliente.delete(rota, params={"versao": 1})

    assert resposta.status_code == 409
    assert cliente.get(rota).status_code == 200


def test_filtro_responsavel_eu_mostra_so_os_incidentes_do_analista(
    cliente: TestClient, cliente_bruno: TestClient
):
    da_ana = criar(cliente)
    do_bruno = criar(cliente)
    criar(cliente)  # sem responsável
    cliente.post(f"/incidentes/{da_ana['id']}/assumir", json={"versao": 1})
    cliente_bruno.post(f"/incidentes/{do_bruno['id']}/assumir", json={"versao": 1})

    corpo = cliente.get("/incidentes", params={"responsavel": "eu"}).json()

    assert [i["id"] for i in corpo["itens"]] == [da_ana["id"]]


def test_filtro_responsavel_com_outro_valor_responde_422(cliente: TestClient):
    assert cliente.get("/incidentes", params={"responsavel": "bruno"}).status_code == 422
