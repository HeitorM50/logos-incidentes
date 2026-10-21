"""Possível duplicata: mesma placa, ou mesmo local e categoria, até 2 h depois de outro ativo."""

from datetime import timedelta

from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from app.models import Incidente
from tests.apoio import acao, criar_incidente


def marcacao(cliente: TestClient, incidente: dict) -> int | None:
    return cliente.get(f"/incidentes/{incidente['id']}").json()["possivel_duplicata_de"]


def test_mesma_placa_marca_o_mais_novo_como_duplicata_do_mais_antigo(cliente: TestClient):
    original = criar_incidente(cliente, placa="RTA4E21")
    copia = criar_incidente(cliente, placa="RTA4E21", local="Outro lugar qualquer")

    assert marcacao(cliente, original) is None
    assert marcacao(cliente, copia) == original["id"]
    listados = {i["id"]: i for i in cliente.get("/incidentes").json()["itens"]}
    assert listados[copia["id"]]["possivel_duplicata_de"] == original["id"]


def test_mesmo_local_e_categoria_marca_mesmo_sem_placa(cliente: TestClient):
    original = criar_incidente(cliente, local="BR-116, km 87 — Guarulhos/SP")
    copia = criar_incidente(cliente, local="  br-116,  km 87 — guarulhos/sp ")
    outra_categoria = criar_incidente(
        cliente, local="BR-116, km 87 — Guarulhos/SP", categoria="bloqueio_pista"
    )

    assert marcacao(cliente, copia) == original["id"]
    assert marcacao(cliente, outra_categoria) is None


def test_fora_da_janela_nao_marca(cliente: TestClient, sessao: Session):
    original = criar_incidente(cliente, placa="RTA4E21")
    sessao.get(Incidente, original["id"]).criado_em -= timedelta(hours=3)
    sessao.commit()

    copia = criar_incidente(cliente, placa="RTA4E21")

    assert marcacao(cliente, copia) is None


def test_original_fechado_nao_conta(cliente: TestClient):
    original = criar_incidente(cliente, placa="RTA4E21")
    original = acao(cliente, original, "assumir").json()
    acao(cliente, original, "status", status="fechado")

    copia = criar_incidente(cliente, placa="RTA4E21")

    assert marcacao(cliente, copia) is None


def test_respostas_sem_gravacao_tambem_trazem_a_duplicata(
    cliente: TestClient, cliente_bruno: TestClient
):
    # O front grava estas respostas no cache: sem o campo, o selo "Dup." sumiria até a
    # próxima leitura.
    original = criar_incidente(cliente, placa="RTA4E21")
    copia = criar_incidente(cliente, placa="RTA4E21")
    assumida = acao(cliente, copia, "assumir").json()

    de_novo = acao(cliente, assumida, "assumir")
    assert de_novo.json()["possivel_duplicata_de"] == original["id"]

    sem_mudanca = cliente.patch(
        f"/incidentes/{copia['id']}", json={"versao": assumida["versao"], "titulo": copia["titulo"]}
    )
    assert sem_mudanca.json()["possivel_duplicata_de"] == original["id"]

    conflito = acao(cliente_bruno, assumida, "assumir")
    assert conflito.status_code == 409
    assert conflito.json()["erro"]["atual"]["possivel_duplicata_de"] == original["id"]
