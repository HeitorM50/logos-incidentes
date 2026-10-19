"""Infraestrutura de testes.

Os testes usam o mesmo Postgres da aplicação, mas dentro de um schema temporário criado no início
da sessão de testes e removido no fim (ADR 0006). Os dados da aplicação nunca são tocados.
"""

import uuid
from collections.abc import Iterator

import pytest
from fastapi.testclient import TestClient
from pydantic import ValidationError
from sqlalchemy import create_engine, text
from sqlalchemy.orm import Session, sessionmaker

from app.core.banco import criar_engine, obter_sessao
from app.core.config import Configuracao, obter_configuracao
from app.main import criar_app
from app.models import Base


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
def cliente(fabrica_sessoes: sessionmaker[Session], sessao: Session) -> TestClient:
    def sessao_de_teste() -> Iterator[Session]:
        with fabrica_sessoes() as sessao_requisicao:
            yield sessao_requisicao

    app = criar_app()
    app.dependency_overrides[obter_sessao] = sessao_de_teste
    return TestClient(app)
