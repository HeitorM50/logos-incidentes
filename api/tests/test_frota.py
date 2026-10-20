"""Contato do motorista: cadastro da frota e cópia no incidente."""

import pytest
from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from app.models import Motorista, Veiculo
from app.schemas.incidente import normalizar_telefone
from app.seed.frota import PLACAS_DA_FROTA, gerar_frota
from tests.apoio import acao, criar_incidente


@pytest.fixture
def veiculo(sessao: Session) -> Veiculo:
    motorista = Motorista(nome="José Almeida", telefone="+5510912345678")
    veiculo = Veiculo(placa="RTA4E21", modelo="Volvo FH 540", motorista=motorista)
    sessao.add(veiculo)
    sessao.commit()
    return veiculo


@pytest.mark.parametrize(
    ("entrada", "gravado"),
    [
        ("(11) 98765-4321", "+5511987654321"),
        ("11 3456-7890", "+551134567890"),
        ("+55 11 98765-4321", "+5511987654321"),
        ("", None),
    ],
)
def test_telefone_e_normalizado(entrada: str, gravado: str | None):
    assert normalizar_telefone(entrada) == gravado


@pytest.mark.parametrize("entrada", ["98765-4321", "123", "+1 415 555 0100"])
def test_telefone_invalido_e_recusado(entrada: str):
    with pytest.raises(ValueError, match="telefone inválido"):
        normalizar_telefone(entrada)


def test_criar_com_placa_cadastrada_copia_o_motorista_atual(
    cliente: TestClient, sessao: Session, veiculo: Veiculo
):
    criado = criar_incidente(cliente, placa="rta-4e21")
    assert (criado["motorista_nome"], criado["motorista_telefone"]) == (
        "José Almeida",
        "+5510912345678",
    )

    # O motorista do veículo muda depois: o incidente guarda quem dirigia naquele momento.
    veiculo.motorista = Motorista(nome="Renata Lima", telefone="+5510987654321")
    sessao.commit()
    assert cliente.get(f"/incidentes/{criado['id']}").json()["motorista_nome"] == "José Almeida"


def test_motorista_informado_pelo_analista_prevalece(cliente: TestClient, veiculo: Veiculo):
    criado = criar_incidente(
        cliente,
        placa="RTA4E21",
        motorista_nome="Motorista reserva",
        motorista_telefone="10 91111-2222",
    )
    assert (criado["motorista_nome"], criado["motorista_telefone"]) == (
        "Motorista reserva",
        "+5510911112222",
    )


def test_placa_fora_da_frota_fica_sem_motorista(cliente: TestClient, veiculo: Veiculo):
    criado = criar_incidente(cliente, placa="ABC1D23")
    assert criado["motorista_nome"] is None


def test_editar_corrige_ou_apaga_o_contato(cliente: TestClient, veiculo: Veiculo):
    criado = criar_incidente(cliente, placa="RTA4E21")
    editado = cliente.patch(
        f"/incidentes/{criado['id']}",
        json={"versao": criado["versao"], "motorista_telefone": "(10) 93333-4444"},
    ).json()
    assert editado["motorista_telefone"] == "+5510933334444"

    apagado = cliente.patch(
        f"/incidentes/{criado['id']}",
        json={"versao": editado["versao"], "motorista_nome": None, "motorista_telefone": None},
    ).json()
    assert (apagado["motorista_nome"], apagado["motorista_telefone"]) == (None, None)
    assert acao(cliente, apagado, "assumir").status_code == 200


def test_get_veiculo_devolve_o_motorista_atual(cliente: TestClient, veiculo: Veiculo):
    resposta = cliente.get("/veiculos/rta-4e21")
    assert resposta.status_code == 200
    assert resposta.json() == {
        "placa": "RTA4E21",
        "modelo": "Volvo FH 540",
        "motorista": {"nome": "José Almeida", "telefone": "+5510912345678"},
    }
    assert cliente.get("/veiculos/ABC1D23").status_code == 404


def test_veiculo_exige_login(cliente_anonimo: TestClient, veiculo: Veiculo):
    # Telefone de motorista é dado pessoal.
    assert cliente_anonimo.get("/veiculos/RTA4E21").status_code == 401


def test_frota_de_demonstracao_usa_ddd_inexistente():
    frota = gerar_frota()
    assert [v.placa for v in frota] == PLACAS_DA_FROTA
    telefones = [v.motorista.telefone for v in frota if v.motorista]
    assert telefones and all(t.startswith("+5510") for t in telefones)
