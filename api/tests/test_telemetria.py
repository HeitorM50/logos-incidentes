"""Telemetria: leituras dos caminhões viram incidentes pelas regras da API."""

from datetime import UTC, datetime, timedelta

import pytest
from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from app.core.dispositivo import hash_da_chave
from app.models import Dispositivo, Incidente, Motorista, Veiculo
from app.schemas.telemetria import LoteTelemetria
from app.services import telemetria as servico

CHAVE = "chave-de-teste-da-rastreadora"


@pytest.fixture
def rastreadora(sessao: Session) -> Dispositivo:
    dispositivo = Dispositivo(
        nome="Central de rastreamento", placa=None, chave_hash=hash_da_chave(CHAVE), ativo=True
    )
    sessao.add_all(
        [
            dispositivo,
            Veiculo(
                placa="RTA4E21",
                modelo="Volvo FH 540",
                motorista=Motorista(nome="José Almeida", telefone="+5510912345678"),
            ),
            Veiculo(placa="ABC1D23", modelo="Scania R 450"),
        ]
    )
    sessao.commit()
    return dispositivo


def leitura(**extra) -> dict:
    return {
        "placa": "RTA4E21",
        "latitude": -24.49,
        "longitude": -47.84,
        "velocidade_kmh": 80,
        "referencia": "Rod. Régis Bittencourt, km 446 — Registro/SP",
    } | extra


def enviar(cliente: TestClient, *leituras: dict, chave: str = CHAVE):
    return cliente.post(
        "/telemetria", json={"leituras": list(leituras)}, headers={"X-Chave-Dispositivo": chave}
    )


def test_leitura_normal_so_atualiza_a_posicao(
    cliente_anonimo: TestClient, sessao: Session, rastreadora: Dispositivo
):
    resposta = enviar(cliente_anonimo, leitura(sinais={"temperatura_motor_c": 90}))

    assert resposta.status_code == 200
    assert resposta.json() == {"processadas": 1, "ignoradas": 0, "incidentes": []}
    veiculo = sessao.get(Veiculo, 1)
    sessao.refresh(veiculo)
    assert (veiculo.latitude, veiculo.velocidade_kmh) == (-24.49, 80)


@pytest.mark.parametrize(
    ("sinais", "regra", "categoria", "criticidade"),
    [
        ({"panico": True}, "panico", "acidente_vitimas", "alta"),
        ({"impacto_g": 5.2}, "impacto", "acidente_veiculo", "alta"),
        ({"temperatura_motor_c": 115}, "motor_quente", "problema_mecanico", "media"),
        ({"visibilidade_m": 40}, "visibilidade", "condicao_climatica", "media"),
    ],
)
def test_sinal_anormal_abre_incidente_da_regra(
    cliente: TestClient,
    cliente_anonimo: TestClient,
    rastreadora: Dispositivo,
    sinais: dict,
    regra: str,
    categoria: str,
    criticidade: str,
):
    resposta = enviar(cliente_anonimo, leitura(sinais=sinais))

    gerados = resposta.json()["incidentes"]
    assert [(g["regra"], g["criticidade"]) for g in gerados] == [(regra, criticidade)]
    incidente = cliente.get(f"/incidentes/{gerados[0]['id']}").json()
    assert incidente["categoria"] == categoria
    assert incidente["local"] == "Rod. Régis Bittencourt, km 446 — Registro/SP"
    assert (incidente["latitude"], incidente["longitude"]) == (-24.49, -47.84)
    assert incidente["dispositivo"]["nome"] == "Central de rastreamento"
    # O motorista vem do cadastro da frota, como na ingestão.
    assert incidente["motorista_nome"] == "José Almeida"


def test_regra_nao_repete_enquanto_o_incidente_esta_ativo(
    cliente_anonimo: TestClient, rastreadora: Dispositivo
):
    primeiro = enviar(cliente_anonimo, leitura(sinais={"panico": True})).json()
    segundo = enviar(cliente_anonimo, leitura(sinais={"panico": True})).json()

    assert len(primeiro["incidentes"]) == 1
    assert segundo["incidentes"] == []


def test_parado_por_mais_de_20_min_abre_bloqueio(sessao: Session, rastreadora: Dispositivo):
    agora = datetime.now(UTC)
    parado = LoteTelemetria.model_validate({"leituras": [leitura(velocidade_kmh=0)]})
    # Primeira leitura parado: marca desde quando; nada ainda.
    assert (
        servico.receber(sessao, rastreadora, parado, agora - timedelta(minutes=25)).incidentes == []
    )
    # 25 min depois, ainda parado com a ignição ligada: vira Bloqueio de Pista (Baixa).
    gerados = servico.receber(sessao, rastreadora, parado, agora).incidentes
    assert [(g.regra, g.criticidade) for g in gerados] == [("parado", "baixa")]


def test_placa_fora_da_frota_e_ignorada(cliente_anonimo: TestClient, rastreadora: Dispositivo):
    resposta = enviar(cliente_anonimo, leitura(placa="ZZZ9Z99", sinais={"panico": True}))
    assert resposta.json() == {"processadas": 0, "ignoradas": 1, "incidentes": []}


def test_cota_por_hora_protege_a_triagem(
    sessao: Session, cliente_anonimo: TestClient, rastreadora: Dispositivo, monkeypatch
):
    monkeypatch.setattr(servico, "COTA_POR_HORA", 1)
    resposta = enviar(
        cliente_anonimo,
        leitura(sinais={"panico": True, "temperatura_motor_c": 120}),
    )
    assert len(resposta.json()["incidentes"]) == 1
    assert sessao.query(Incidente).count() == 1


def test_chave_errada_e_mapa_exigem_credencial(
    cliente_anonimo: TestClient, rastreadora: Dispositivo
):
    assert enviar(cliente_anonimo, leitura(), chave="chave-errada-123456").status_code == 401
    assert cliente_anonimo.get("/frota").status_code == 401


def test_mapa_traz_rotas_posicoes_e_o_incidente_ativo(
    cliente: TestClient, cliente_anonimo: TestClient, rastreadora: Dispositivo
):
    gerado = enviar(cliente_anonimo, leitura(sinais={"impacto_g": 6})).json()["incidentes"][0]

    mapa = cliente.get("/frota").json()

    assert len(mapa["rotas"]) >= 10
    veiculos = {v["placa"]: v for v in mapa["veiculos"]}
    assert veiculos["RTA4E21"]["incidente"]["id"] == gerado["id"]
    assert veiculos["RTA4E21"]["motorista"] == "José Almeida"
    assert veiculos["ABC1D23"]["latitude"] is None
