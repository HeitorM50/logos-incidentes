from fastapi.testclient import TestClient

from app.seed.analistas import SENHA_DEMO


def test_login_com_credenciais_corretas_devolve_token(cliente_anonimo: TestClient, analistas):
    resposta = cliente_anonimo.post("/auth/login", json={"usuario": "ana", "senha": SENHA_DEMO})

    assert resposta.status_code == 200
    corpo = resposta.json()
    assert corpo["analista"] == {"id": analistas["ana"].id, "nome": "Ana Souza", "usuario": "ana"}

    eu = cliente_anonimo.get("/auth/eu", headers={"Authorization": f"Bearer {corpo['token']}"})
    assert eu.json()["usuario"] == "ana"


def test_login_com_senha_errada_ou_usuario_inexistente_responde_401(
    cliente_anonimo: TestClient, analistas
):
    senha_errada = cliente_anonimo.post("/auth/login", json={"usuario": "ana", "senha": "x"})
    inexistente = cliente_anonimo.post(
        "/auth/login", json={"usuario": "fantasma", "senha": SENHA_DEMO}
    )

    # A mesma resposta nos dois casos: não revela quais usuários existem.
    assert senha_errada.status_code == inexistente.status_code == 401
    assert senha_errada.json() == inexistente.json()
    assert senha_errada.json()["erro"]["codigo"] == "credenciais_invalidas"


def test_login_bloqueia_apos_5_tentativas_por_minuto(cliente_anonimo: TestClient, analistas):
    for _ in range(5):
        cliente_anonimo.post("/auth/login", json={"usuario": "ana", "senha": "errada"})

    resposta = cliente_anonimo.post("/auth/login", json={"usuario": "ana", "senha": SENHA_DEMO})

    assert resposta.status_code == 429
    assert resposta.json()["erro"]["codigo"] == "muitas_tentativas"
    assert resposta.headers["Retry-After"] == "60"


def test_rotas_de_incidentes_exigem_token(cliente_anonimo: TestClient):
    resposta = cliente_anonimo.get("/incidentes")

    assert resposta.status_code == 401
    assert resposta.json()["erro"]["codigo"] == "nao_autenticado"
    assert resposta.headers["WWW-Authenticate"] == "Bearer"


def test_token_invalido_responde_401(cliente_anonimo: TestClient):
    resposta = cliente_anonimo.get(
        "/incidentes", headers={"Authorization": "Bearer token.falso.qualquer"}
    )

    assert resposta.status_code == 401


def test_health_nao_exige_token(cliente_anonimo: TestClient):
    assert cliente_anonimo.get("/health").status_code == 200


def test_alteracao_registra_o_analista_que_fez(cliente: TestClient, analistas):
    resposta = cliente.post(
        "/incidentes",
        json={
            "titulo": "Bloqueio por protesto",
            "categoria": "bloqueio_pista",
            "criticidade": "alta",
            "local": "BR-040, km 10",
        },
    )

    assert resposta.json()["atualizado_por"] == {"id": analistas["ana"].id, "nome": "Ana Souza"}


def test_cors_libera_apenas_a_origem_configurada(cliente_anonimo: TestClient):
    permitida = cliente_anonimo.options(
        "/incidentes",
        headers={"Origin": "http://localhost:5173", "Access-Control-Request-Method": "GET"},
    )
    bloqueada = cliente_anonimo.options(
        "/incidentes",
        headers={"Origin": "https://site-malicioso.com", "Access-Control-Request-Method": "GET"},
    )

    assert permitida.headers.get("access-control-allow-origin") == "http://localhost:5173"
    assert "access-control-allow-origin" not in bloqueada.headers
