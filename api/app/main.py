from fastapi import FastAPI

from app.core.erros import registrar_tratadores
from app.routers import incidentes, saude


def criar_app() -> FastAPI:
    """Monta a aplicação. A factory permite criar instâncias isoladas nos testes."""
    app = FastAPI(
        title="Logos API",
        description="Central de resposta a incidentes de uma frota de caminhões.",
        version="0.1.0",
    )
    registrar_tratadores(app)
    app.include_router(saude.router)
    app.include_router(incidentes.router)
    return app


app = criar_app()
