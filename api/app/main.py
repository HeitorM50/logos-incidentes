from fastapi import FastAPI

from app.routers import saude


def criar_app() -> FastAPI:
    """Monta a aplicação. A factory permite criar instâncias isoladas nos testes."""
    app = FastAPI(
        title="Logos API",
        description="Central de resposta a incidentes de uma frota de caminhões.",
        version="0.1.0",
    )
    app.include_router(saude.router)
    return app


app = criar_app()
