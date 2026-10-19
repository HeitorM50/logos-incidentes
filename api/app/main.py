from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from slowapi.errors import RateLimitExceeded

from app.core.config import obter_configuracao
from app.core.erros import corpo_erro, registrar_tratadores
from app.core.limite import limitador
from app.routers import auth, incidentes, saude


def _limite_excedido(_: Request, erro: RateLimitExceeded) -> JSONResponse:
    return JSONResponse(
        status_code=429,
        content=corpo_erro(
            "muitas_tentativas", "Muitas tentativas de login. Aguarde um minuto e tente de novo."
        ),
        headers={"Retry-After": "60"},
    )


def criar_app() -> FastAPI:
    """Monta a aplicação. A factory permite criar instâncias isoladas nos testes."""
    app = FastAPI(
        title="Logos API",
        description="Central de resposta a incidentes de uma frota de caminhões.",
        version="0.1.0",
    )
    app.state.limiter = limitador
    app.add_exception_handler(RateLimitExceeded, _limite_excedido)
    registrar_tratadores(app)

    app.add_middleware(
        CORSMiddleware,
        allow_origins=_origens_cors(),
        allow_methods=["GET", "POST", "PATCH", "DELETE"],
        allow_headers=["Authorization", "Content-Type"],
        expose_headers=["Retry-After"],
    )

    app.include_router(saude.router)
    app.include_router(auth.router)
    app.include_router(incidentes.router)
    return app


def _origens_cors() -> list[str]:
    try:
        return obter_configuracao().cors_origens
    except ValueError:
        # Sem configuração (ex.: gerar a documentação), nenhuma origem externa é liberada.
        return []


app = criar_app()
