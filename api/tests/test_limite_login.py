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


def test_usuarios_sem_falha_recente_saem_da_memoria():
    # Um nome inventado por tentativa não pode fazer a memória crescer para sempre.
    relogio = RelogioFalso()
    limite = LimiteFalhasLogin(janela_segundos=60, relogio=relogio)
    limite.LIMITE_PARA_VARRER = 10
    for i in range(11):
        limite.registrar_falha(f"inventado-{i}")

    relogio.agora = 61
    limite.registrar_falha("ana")

    assert limite.usuarios_guardados() == 1
    assert not limite.bloqueado("inventado-0")


def test_limite_por_ip_usa_o_ip_da_cloudflare_e_ignora_x_forwarded_for(
    cliente_anonimo: TestClient,
):
    # Na API publicada, um X-Forwarded-For novo a cada tentativa furava o limite por IP. A
    # Cloudflare grava o IP real em CF-Connecting-IP e sobrescreve o que o cliente mandar.
    respostas = [
        cliente_anonimo.post(
            "/auth/login",
            json={"usuario": f"inventado-{i}", "senha": "chute"},
            headers={"CF-Connecting-IP": "198.51.100.7", "X-Forwarded-For": f"203.0.113.{i}"},
        ).status_code
        for i in range(6)
    ]

    assert respostas == [401] * 5 + [429]

    # Outro cliente (outro IP real) continua podendo entrar.
    outro = cliente_anonimo.post(
        "/auth/login",
        json={"usuario": "inventado-x", "senha": "chute"},
        headers={"CF-Connecting-IP": "198.51.100.8"},
    )
    assert outro.status_code == 401
