"""Ingestão pelos caminhões: chave de dispositivo e idempotência (ADR 0008)."""

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.core.dispositivo import hash_da_chave
from app.models import Dispositivo, Incidente
from app.services import ingestao as servico

CHAVE = "chave-de-teste-do-caminhao"
CORPO = {
    "titulo": "Tombamento de carreta na serra",
    "categoria": "acidente_veiculo",
    "criticidade": "alta",
    "local": "BR-376, km 668 — Guaratuba/PR",
}


@pytest.fixture
def caminhao(sessao: Session) -> Dispositivo:
    dispositivo = Dispositivo(
        nome="Caminhão 042", placa="RTA4E21", chave_hash=hash_da_chave(CHAVE), ativo=True
    )
    sessao.add(dispositivo)
    sessao.commit()
    return dispositivo


def enviar(cliente: TestClient, idempotencia: str = "envio-0001", chave: str = CHAVE, **corpo):
    return cliente.post(
        "/ingestao/incidentes",
        json=CORPO | corpo,
        headers={"X-Chave-Dispositivo": chave, "Idempotency-Key": idempotencia},
    )


def total_de_incidentes(sessao: Session) -> int:
    sessao.expire_all()
    return sessao.scalar(select(func.count()).select_from(Incidente))


def test_cria_o_incidente_com_a_origem_e_a_placa_do_caminhao(
    cliente_anonimo: TestClient, caminhao: Dispositivo, cliente: TestClient
):
    resposta = enviar(cliente_anonimo)

    assert resposta.status_code == 201
    incidente = resposta.json()
    assert incidente["status"] == "aberto"
    assert incidente["placa"] == "RTA4E21"  # sem placa no corpo, vale a do caminhão
    assert incidente["dispositivo"] == {
        "id": caminhao.id,
        "nome": "Caminhão 042",
        "placa": "RTA4E21",
    }
    # O histórico registra o recebimento sem autor (não foi um analista).
    eventos = cliente.get(f"/incidentes/{incidente['id']}/eventos").json()
    assert [(e["tipo"], e["analista"]) for e in eventos] == [("criado", None)]
    # E os analistas veem o incidente na triagem.
    assert any(i["id"] == incidente["id"] for i in cliente.get("/incidentes").json()["itens"])


def test_reenvio_com_a_mesma_chave_nao_duplica(
    cliente_anonimo: TestClient, caminhao: Dispositivo, sessao: Session
):
    primeiro = enviar(cliente_anonimo)
    reenvio = enviar(cliente_anonimo)

    assert primeiro.status_code == 201
    assert reenvio.status_code == 200
    assert reenvio.headers["Idempotent-Replayed"] == "true"
    assert reenvio.json()["id"] == primeiro.json()["id"]
    assert total_de_incidentes(sessao) == 1


def test_chaves_diferentes_criam_incidentes_diferentes(
    cliente_anonimo: TestClient, caminhao: Dispositivo, sessao: Session
):
    assert enviar(cliente_anonimo, "envio-0001").status_code == 201
    assert enviar(cliente_anonimo, "envio-0002").status_code == 201
    assert total_de_incidentes(sessao) == 2


def test_dois_reenvios_ao_mesmo_tempo_geram_um_incidente_so(
    cliente_anonimo: TestClient, caminhao: Dispositivo, sessao: Session, monkeypatch
):
    # Simula a corrida: o segundo envio passa pela checagem antes de o primeiro gravar. Quem
    # decide é a restrição UNIQUE do banco; o perdedor desfaz tudo e devolve o do vencedor.
    primeiro = enviar(cliente_anonimo).json()
    original = servico._ja_recebido
    chamadas = {"n": 0}

    def nao_ve_na_primeira(*args):
        chamadas["n"] += 1
        return None if chamadas["n"] == 1 else original(*args)

    monkeypatch.setattr(servico, "_ja_recebido", nao_ve_na_primeira)

    reenvio = enviar(cliente_anonimo)

    assert reenvio.status_code == 200
    assert reenvio.json()["id"] == primeiro["id"]
    assert total_de_incidentes(sessao) == 1


def test_reenvio_depois_de_a_central_remover_responde_409(
    cliente_anonimo: TestClient, caminhao: Dispositivo, cliente: TestClient
):
    criado = enviar(cliente_anonimo).json()
    removido = cliente.delete(f"/incidentes/{criado['id']}", params={"versao": criado["versao"]})
    assert removido.status_code == 204

    reenvio = enviar(cliente_anonimo)

    assert reenvio.status_code == 409
    assert reenvio.json()["erro"]["codigo"] == "ja_recebido"


@pytest.mark.parametrize("chave", ["", "chave-errada"])
def test_sem_chave_valida_responde_401(cliente_anonimo: TestClient, caminhao, chave: str):
    resposta = enviar(cliente_anonimo, chave=chave)
    assert resposta.status_code == 401
    assert resposta.json()["erro"]["codigo"] == "nao_autenticado"


def test_dispositivo_desativado_perde_o_acesso(
    cliente_anonimo: TestClient, caminhao: Dispositivo, sessao: Session
):
    caminhao.ativo = False
    sessao.commit()
    assert enviar(cliente_anonimo).status_code == 401


@pytest.mark.parametrize("idempotencia", ["curta", "com espaco no meio", "x" * 65])
def test_idempotency_key_invalida_responde_422(
    cliente_anonimo: TestClient, caminhao, idempotencia: str
):
    assert enviar(cliente_anonimo, idempotencia).status_code == 422


def test_sem_idempotency_key_responde_422(cliente_anonimo: TestClient, caminhao):
    resposta = cliente_anonimo.post(
        "/ingestao/incidentes", json=CORPO, headers={"X-Chave-Dispositivo": CHAVE}
    )
    assert resposta.status_code == 422


def test_corpo_invalido_responde_422_e_nao_grava(
    cliente_anonimo: TestClient, caminhao, sessao: Session
):
    resposta = enviar(cliente_anonimo, categoria="meteoro")
    assert resposta.status_code == 422
    assert total_de_incidentes(sessao) == 0


def test_jwt_de_analista_nao_serve_para_a_ingestao(cliente: TestClient, caminhao):
    resposta = cliente.post(
        "/ingestao/incidentes", json=CORPO, headers={"Idempotency-Key": "envio-0001"}
    )
    assert resposta.status_code == 401


def test_mesma_chave_com_outro_corpo_responde_422(
    cliente_anonimo: TestClient, caminhao: Dispositivo, sessao: Session
):
    # Defeito do rastreador: devolver o incidente antigo com 200 sumiria com a ocorrência nova.
    assert enviar(cliente_anonimo).status_code == 201

    resposta = enviar(cliente_anonimo, titulo="Outra ocorrência com a mesma chave")

    assert resposta.status_code == 422
    assert resposta.json()["erro"]["codigo"] == "chave_reutilizada"
    assert total_de_incidentes(sessao) == 1


def test_limite_por_ip_vale_antes_de_autenticar(cliente_anonimo: TestClient, caminhao):
    # Chave errada também conta: senão o limite não protegeria contra força bruta.
    respostas = [enviar(cliente_anonimo, chave="errada").status_code for _ in range(61)]

    assert respostas[:60] == [401] * 60
    assert respostas[60] == 429


def test_cota_por_dispositivo(
    cliente_anonimo: TestClient, caminhao: Dispositivo, sessao: Session, monkeypatch
):
    monkeypatch.setattr(servico, "COTA_POR_HORA", 2)
    assert enviar(cliente_anonimo, "envio-0001").status_code == 201
    assert enviar(cliente_anonimo, "envio-0002").status_code == 201

    resposta = enviar(cliente_anonimo, "envio-0003")

    assert resposta.status_code == 429
    assert resposta.json()["erro"]["codigo"] == "cota_do_dispositivo"
    # Reenvio de algo já recebido não gasta cota.
    assert enviar(cliente_anonimo, "envio-0001").status_code == 200


def test_chave_de_dispositivo_nao_serve_nas_rotas_dos_analistas(
    cliente_anonimo: TestClient, caminhao
):
    resposta = cliente_anonimo.get("/incidentes", headers={"X-Chave-Dispositivo": CHAVE})
    assert resposta.status_code == 401


def test_outra_violacao_de_integridade_nao_vira_reenvio(
    cliente_anonimo: TestClient, caminhao: Dispositivo, sessao: Session, monkeypatch
):
    # Mesmo cenário da corrida, mas a violação "não é" a da chave única: tem de ser erro (500),
    # nunca um 200 que esconderia o problema.
    enviar(cliente_anonimo)
    original = servico._ja_recebido
    chamadas = {"n": 0}

    def nao_ve_na_primeira(*args):
        chamadas["n"] += 1
        return None if chamadas["n"] == 1 else original(*args)

    monkeypatch.setattr(servico, "_ja_recebido", nao_ve_na_primeira)
    monkeypatch.setattr(servico, "_violou_a_chave_unica", lambda _erro: False)

    assert enviar(cliente_anonimo).status_code == 500
    assert total_de_incidentes(sessao) == 1
