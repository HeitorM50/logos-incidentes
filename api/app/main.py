from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from slowapi.errors import RateLimitExceeded

from app.core.config import obter_configuracao
from app.core.erros import corpo_erro, registrar_tratadores
from app.core.limite import limitador
from app.core.resiliencia import registrar_simulacao_de_falhas, registrar_tratadores_de_banco
from app.routers import analistas, auth, frota, incidentes, ingestao, regras, relatorio, saude


def _limite_excedido(_: Request, erro: RateLimitExceeded) -> JSONResponse:
    return JSONResponse(
        status_code=429,
        content=corpo_erro(
            "muitas_tentativas", "Muitas tentativas de login. Aguarde um minuto e tente de novo."
        ),
        headers={"Retry-After": "60"},
    )


def criar_app(
    simular_latencia_ms: int | None = None, simular_falha_pct: float | None = None
) -> FastAPI:
    """Monta a aplicação. A factory permite criar instâncias isoladas nos testes."""
    app = FastAPI(
        title="Logos API",
        description="Central de resposta a incidentes de uma frota de caminhões.",
        version="0.1.0",
    )
    app.state.limiter = limitador
    app.add_exception_handler(RateLimitExceeded, _limite_excedido)
    registrar_tratadores(app)
    registrar_tratadores_de_banco(app)
    latencia, falha = _simulacao(simular_latencia_ms, simular_falha_pct)
    registrar_simulacao_de_falhas(app, latencia, falha)

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
    app.include_router(ingestao.router)
    app.include_router(regras.router)
    app.include_router(frota.router)
    app.include_router(analistas.router)
    app.include_router(relatorio.router)
    return app


def _origens_cors() -> list[str]:
    try:
        return obter_configuracao().cors_origens
    except ValueError:
        # Sem configuração (ex.: gerar a documentação), nenhuma origem externa é liberada.
        return []


def _simulacao(latencia_ms: int | None, falha_pct: float | None) -> tuple[int, float]:
    try:
        config = obter_configuracao()
        padrao = (config.simular_latencia_ms, config.simular_falha_pct)
    except ValueError:
        padrao = (0, 0.0)
    return (
        padrao[0] if latencia_ms is None else latencia_ms,
        padrao[1] if falha_pct is None else falha_pct,
    )


app = criar_app()
