from collections.abc import Iterator

from fastapi.testclient import TestClient
from sqlalchemy.orm import Session, sessionmaker

from app.core.banco import criar_engine, obter_sessao
from app.main import criar_app


def test_health_responde_ok_com_banco_ativo(cliente_anonimo: TestClient):
    resposta = cliente_anonimo.get("/health")

    assert resposta.status_code == 200
    assert resposta.json() == {"status": "ok", "banco": "ok"}


def test_health_responde_503_sem_banco():
    # Porta 1 recusa conexão imediatamente: simula banco fora do ar.
    engine = criar_engine("postgresql+psycopg://x:x@127.0.0.1:1/x", timeout_consulta_ms=1000)
    fabrica = sessionmaker(bind=engine)

    def sessao_sem_banco() -> Iterator[Session]:
        with fabrica() as sessao:
            yield sessao

    app = criar_app()
    app.dependency_overrides[obter_sessao] = sessao_sem_banco

    resposta = TestClient(app).get("/health")

    assert resposta.status_code == 503
    assert resposta.json()["banco"] == "indisponivel"
