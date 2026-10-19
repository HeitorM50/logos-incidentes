"""Infraestrutura de testes.

Os testes usam o mesmo Postgres da aplicação, mas dentro de um schema temporário criado no início
da sessão de testes e removido no fim (ADR 0006). Os dados da aplicação nunca são tocados.
"""

import uuid
from collections.abc import Iterator
from datetime import timedelta

import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient
from pydantic import ValidationError
from sqlalchemy import create_engine, text
from sqlalchemy.orm import Session, sessionmaker

from app.core.banco import criar_engine, obter_sessao
from app.core.config import Configuracao, obter_configuracao
from app.core.limite import falhas_login, limitador
from app.core.seguranca import criar_token, gerar_hash_senha
from app.main import criar_app
from app.models import Analista, Base
from app.seed.analistas import SENHA_DEMO


@pytest.fixture(scope="session")
def configuracao() -> Configuracao:
    try:
        return obter_configuracao()
    except ValidationError:
        pytest.skip("DATABASE_URL e JWT_SEGREDO não configurados; testes com banco ignorados.")


@pytest.fixture(scope="session")
def fabrica_sessoes(configuracao: Configuracao) -> Iterator[sessionmaker[Session]]:
    schema = f"testes_{uuid.uuid4().hex[:12]}"
    administrador = create_engine(configuracao.database_url)
    with administrador.begin() as conexao:
        conexao.execute(text(f'CREATE SCHEMA "{schema}"'))

    engine = criar_engine(
        configuracao.database_url, configuracao.timeout_consulta_ms, schema=schema
    )
    Base.metadata.create_all(engine)
    try:
        yield sessionmaker(bind=engine, expire_on_commit=False)
    finally:
        engine.dispose()
        with administrador.begin() as conexao:
            conexao.execute(text(f'DROP SCHEMA "{schema}" CASCADE'))
        administrador.dispose()


@pytest.fixture
def sessao(fabrica_sessoes: sessionmaker[Session]) -> Iterator[Session]:
    with fabrica_sessoes() as sessao:
        yield sessao
    # Cada teste começa com as tabelas vazias.
    with fabrica_sessoes.begin() as limpeza:
        limpeza.execute(text("TRUNCATE incidentes, analistas RESTART IDENTITY CASCADE"))


@pytest.fixture
def app_teste(fabrica_sessoes: sessionmaker[Session], sessao: Session) -> FastAPI:
    def sessao_de_teste() -> Iterator[Session]:
        with fabrica_sessoes() as sessao_requisicao:
            yield sessao_requisicao

    limitador.reset()
    falhas_login.reiniciar()
    app = criar_app()
    app.dependency_overrides[obter_sessao] = sessao_de_teste
    return app


@pytest.fixture(scope="session")
def hash_senha_demo() -> str:
    # bcrypt é lento de propósito; o hash é calculado uma vez para a sessão de testes inteira.
    return gerar_hash_senha(SENHA_DEMO)


@pytest.fixture
def analistas(sessao: Session, hash_senha_demo: str) -> dict[str, Analista]:
    contas = {
        "ana": Analista(usuario="ana", nome="Ana Souza", senha_hash=hash_senha_demo),
        "bruno": Analista(usuario="bruno", nome="Bruno Lima", senha_hash=hash_senha_demo),
    }
    sessao.add_all(contas.values())
    sessao.commit()
    return contas


def _cliente_de(app: FastAPI, analista: Analista, configuracao: Configuracao) -> TestClient:
    token, _ = criar_token(analista.id, configuracao.jwt_segredo, timedelta(hours=1))
    return TestClient(app, headers={"Authorization": f"Bearer {token}"})


@pytest.fixture
def cliente_anonimo(app_teste: FastAPI) -> TestClient:
    return TestClient(app_teste)


@pytest.fixture
def cliente(app_teste, analistas, configuracao) -> TestClient:
    """Cliente autenticado como Ana."""
    return _cliente_de(app_teste, analistas["ana"], configuracao)


@pytest.fixture
def cliente_bruno(app_teste, analistas, configuracao) -> TestClient:
    """Segundo analista, para os cenários de concorrência."""
    return _cliente_de(app_teste, analistas["bruno"], configuracao)
