from collections.abc import Iterator
from functools import lru_cache
from typing import Annotated

from fastapi import Depends
from sqlalchemy import Engine, create_engine, event
from sqlalchemy.orm import Session, sessionmaker

from app.core.config import obter_configuracao
from app.core.resiliencia import com_retry


def criar_engine(url: str, timeout_consulta_ms: int, schema: str | None = None) -> Engine:
    """Cria o engine com proteções contra banco lento e conexões mortas (ADR 0003).

    `schema` é usado pelos testes para isolar os dados num schema temporário.
    """
    engine = create_engine(
        url,
        pool_pre_ping=True,  # descarta conexões derrubadas antes de usá-las
        pool_size=5,
        max_overflow=5,
        pool_timeout=10,  # espera máxima por uma conexão livre no pool
        connect_args={"connect_timeout": 3},
    )

    @event.listens_for(engine, "connect")
    def configurar_sessao(conexao_dbapi, _registro):
        with conexao_dbapi.cursor() as cursor:
            cursor.execute(f"SET statement_timeout = {int(timeout_consulta_ms)}")
            if schema:
                cursor.execute(f'SET search_path TO "{schema}"')
        conexao_dbapi.commit()

    return engine


@lru_cache
def obter_fabrica_sessoes() -> sessionmaker[Session]:
    config = obter_configuracao()
    engine = criar_engine(config.database_url, config.timeout_consulta_ms)
    return sessionmaker(bind=engine, expire_on_commit=False)


def obter_sessao() -> Iterator[Session]:
    """Dependência do FastAPI: uma sessão por requisição, sempre fechada no fim."""
    with obter_fabrica_sessoes()() as sessao:
        # Abre a conexão já no início, com retry: falha transitória não derruba a requisição.
        com_retry(sessao.connection)
        yield sessao


SessaoDep = Annotated[Session, Depends(obter_sessao)]
