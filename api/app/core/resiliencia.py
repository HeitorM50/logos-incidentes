"""Tratamento de banco lento ou indisponível (ADR 0003)."""

import asyncio
import logging
import random
import time
from collections.abc import Callable, Sequence

from fastapi import FastAPI, Request
from fastapi.responses import JSONResponse
from sqlalchemy.exc import OperationalError
from sqlalchemy.exc import TimeoutError as TimeoutPool

from app.core.erros import corpo_erro

logger = logging.getLogger("logos")

# Esperas entre tentativas: 3 tentativas no total, com backoff crescente.
ESPERAS_PADRAO: Sequence[float] = (0.2, 0.6)
RETRY_AFTER_SEGUNDOS = "5"
METODOS_DE_ESCRITA = frozenset({"POST", "PATCH", "PUT", "DELETE"})


def com_retry[T](
    operacao: Callable[[], T],
    esperas: Sequence[float] = ESPERAS_PADRAO,
    dormir: Callable[[float], None] = time.sleep,
) -> T:
    """Repete `operacao` em erro transitório de conexão.

    Só é usado para abrir a conexão, antes de qualquer gravação: repetir uma escrita já enviada
    poderia aplicá-la duas vezes.
    """
    for espera in esperas:
        try:
            return operacao()
        except OperationalError:
            logger.warning("Falha transitória no banco; nova tentativa em %.1fs", espera)
            dormir(espera)
    return operacao()


def resposta_indisponivel(mensagem: str) -> JSONResponse:
    return JSONResponse(
        status_code=503,
        content=corpo_erro("servico_indisponivel", mensagem),
        headers={"Retry-After": RETRY_AFTER_SEGUNDOS},
    )


def registrar_tratadores_de_banco(app: FastAPI) -> None:
    @app.exception_handler(OperationalError)
    async def banco_indisponivel(_: Request, erro: OperationalError):
        # Cobre conexão recusada/derrubada e consulta cancelada por statement_timeout.
        logger.error("Banco indisponível ou lento: %s", erro.orig)
        return resposta_indisponivel(
            "O banco de dados está lento ou indisponível. Tente novamente em instantes."
        )

    @app.exception_handler(TimeoutPool)
    async def pool_esgotado(_: Request, erro: TimeoutPool):
        logger.error("Sem conexão livre no pool: %s", erro)
        return resposta_indisponivel("O sistema está sobrecarregado. Tente novamente em instantes.")


def registrar_simulacao_de_falhas(app: FastAPI, latencia_ms: int, falha_pct: float) -> None:
    """Injeta atraso e falha nas rotas de incidentes para demonstrar o rollback no front.

    Desligada por padrão; só é ativada por SIMULAR_LATENCIA_MS / SIMULAR_FALHA_PCT.
    O atraso vale para toda rota de incidentes (mostra os estados de carregamento);
    a falha, só para escritas (mostra o rollback da atualização otimista).
    """
    if latencia_ms <= 0 and falha_pct <= 0:
        return
    logger.warning(
        "Simulação de falhas ATIVA: %sms de atraso, %s%% de falha", latencia_ms, falha_pct
    )

    @app.middleware("http")
    async def simular(request: Request, proximo):
        if not request.url.path.startswith("/incidentes"):
            return await proximo(request)
        if latencia_ms > 0:
            await asyncio.sleep(latencia_ms / 1000)
        if request.method in METODOS_DE_ESCRITA and random.uniform(0, 100) < falha_pct:
            return resposta_indisponivel("Falha simulada no banco de dados (modo demonstração).")
        return await proximo(request)
