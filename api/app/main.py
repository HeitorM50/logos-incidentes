from fastapi import FastAPI


def criar_app() -> FastAPI:
    """Monta a aplicação. A factory permite criar instâncias isoladas nos testes."""
    return FastAPI(
        title="Logos API",
        description="Central de resposta a incidentes de uma frota de caminhões.",
        version="0.1.0",
    )


app = criar_app()
