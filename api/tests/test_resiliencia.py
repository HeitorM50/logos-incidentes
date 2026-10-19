"""Banco lento ou indisponível (ADR 0003)."""

from collections.abc import Iterator

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import text
from sqlalchemy.exc import OperationalError
from sqlalchemy.orm import Session, sessionmaker

from app.core.banco import criar_engine, obter_sessao
from app.core.config import Configuracao
from app.core.resiliencia import com_retry
from app.main import criar_app
from tests.apoio import acao, criar_incidente


def _erro_transitorio() -> OperationalError:
    return OperationalError("SELECT 1", {}, Exception("conexão perdida"))


# --- Retry ---------------------------------------------------------------------------


def test_retry_recupera_de_falha_transitoria():
    tentativas = []
    esperas = []

    def operacao():
        tentativas.append(1)
        if len(tentativas) < 3:
            raise _erro_transitorio()
        return "ok"

    assert com_retry(operacao, esperas=(0.2, 0.6), dormir=esperas.append) == "ok"
    assert len(tentativas) == 3
    assert esperas == [0.2, 0.6]  # backoff crescente


def test_retry_desiste_depois_da_ultima_tentativa():
    def sempre_falha():
        raise _erro_transitorio()

    with pytest.raises(OperationalError):
        com_retry(sempre_falha, esperas=(0.1,), dormir=lambda _: None)


def test_retry_nao_repete_erros_que_nao_sao_de_conexao():
    tentativas = []

    def erro_de_programacao():
        tentativas.append(1)
        raise ValueError("bug")

    with pytest.raises(ValueError):
        com_retry(erro_de_programacao, dormir=lambda _: None)
    assert len(tentativas) == 1


# --- Banco indisponível e lento ------------------------------------------------------


def test_banco_fora_do_ar_responde_503_com_retry_after(cliente_anonimo: TestClient):
    def sessao_sem_banco() -> Iterator[Session]:
        engine = criar_engine("postgresql+psycopg://x:x@127.0.0.1:1/x", timeout_consulta_ms=1000)
        with sessionmaker(bind=engine)() as sessao:
            yield sessao

    cliente_anonimo.app.dependency_overrides[obter_sessao] = sessao_sem_banco

    resposta = cliente_anonimo.post("/auth/login", json={"usuario": "ana", "senha": "x"})

    assert resposta.status_code == 503
    assert resposta.json()["erro"]["codigo"] == "servico_indisponivel"
    assert resposta.headers["Retry-After"] == "5"
    assert "Traceback" not in resposta.text


def test_consulta_lenta_e_cancelada_pelo_timeout(configuracao: Configuracao):
    engine = criar_engine(configuracao.database_url, timeout_consulta_ms=200)
    try:
        with engine.connect() as conexao, pytest.raises(OperationalError):
            conexao.execute(text("SELECT pg_sleep(2)"))
    finally:
        engine.dispose()


# --- Simulação de falhas para demonstração -------------------------------------------


@pytest.fixture
def cliente_com_falha_total(fabrica_sessoes, analistas, configuracao, cliente) -> TestClient:
    def sessao_de_teste() -> Iterator[Session]:
        with fabrica_sessoes() as sessao:
            yield sessao

    app = criar_app(simular_latencia_ms=0, simular_falha_pct=100)
    app.dependency_overrides[obter_sessao] = sessao_de_teste
    return TestClient(app, headers=dict(cliente.headers))


def test_simulacao_falha_escritas_mas_nao_leituras(
    cliente: TestClient, cliente_com_falha_total: TestClient
):
    incidente = criar_incidente(cliente)

    leitura = cliente_com_falha_total.get(f"/incidentes/{incidente['id']}")
    escrita = acao(cliente_com_falha_total, incidente, "assumir")

    assert leitura.status_code == 200
    assert escrita.status_code == 503
    # A falha simulada acontece antes de gravar: o incidente continua intacto.
    assert cliente.get(f"/incidentes/{incidente['id']}").json()["versao"] == 1


def test_simulacao_desligada_por_padrao(cliente: TestClient):
    incidente = criar_incidente(cliente)

    assert acao(cliente, incidente, "assumir").status_code == 200
