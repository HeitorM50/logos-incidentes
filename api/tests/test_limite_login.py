from fastapi.testclient import TestClient

from app.core.limite import LimiteFalhasLogin, limitador
from app.seed.analistas import SENHA_DEMO


class RelogioFalso:
    def __init__(self):
        self.agora = 0.0

    def __call__(self) -> float:
        return self.agora


def test_bloqueia_apos_o_maximo_de_falhas_e_libera_depois_da_janela():
    relogio = RelogioFalso()
    limite = LimiteFalhasLogin(maximo_falhas=3, janela_segundos=60, relogio=relogio)

    for _ in range(3):
        limite.registrar_falha("ana")
    assert limite.bloqueado("ana")
    assert not limite.bloqueado("bruno")  # cada usuário tem a sua contagem

    relogio.agora = 61
    assert not limite.bloqueado("ana")


def test_login_correto_zera_as_falhas():
    limite = LimiteFalhasLogin(maximo_falhas=3)
    limite.registrar_falha("ana")
    limite.registrar_falha("ana")

    limite.limpar("ana")
    limite.registrar_falha("ana")

    assert not limite.bloqueado("ana")


def test_limite_por_usuario_vale_mesmo_trocando_de_ip(cliente_anonimo: TestClient, analistas):
    # Simula o atacante que forja um X-Forwarded-For novo a cada tentativa:
    # o limite por IP não o pega, mas o limite por usuário sim.
    limitador.enabled = False
    try:
        for _ in range(5):
            cliente_anonimo.post("/auth/login", json={"usuario": "ana", "senha": "chute"})

        resposta = cliente_anonimo.post("/auth/login", json={"usuario": "ANA", "senha": SENHA_DEMO})
    finally:
        limitador.enabled = True

    assert resposta.status_code == 429
    assert resposta.json()["erro"]["codigo"] == "muitas_tentativas"
