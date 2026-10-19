"""Formato único de erro da API (docs/contrato-api.md)."""

import logging
from typing import Any

from fastapi import FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
from starlette.exceptions import HTTPException as StarletteHTTPException

logger = logging.getLogger("logos")


class ErroApi(Exception):
    """Erro de negócio com status HTTP e código estável que o front sabe tratar."""

    def __init__(
        self,
        status: int,
        codigo: str,
        mensagem: str,
        *,
        atual: Any = None,
        cabecalhos: dict[str, str] | None = None,
    ):
        super().__init__(mensagem)
        self.status = status
        self.codigo = codigo
        self.mensagem = mensagem
        self.atual = atual
        self.cabecalhos = cabecalhos


CODIGOS_HTTP: dict[int, tuple[str, str]] = {
    404: ("nao_encontrado", "Recurso não encontrado."),
    405: ("metodo_nao_permitido", "Método não permitido nesta rota."),
}


def corpo_erro(codigo: str, mensagem: str, **extras: Any) -> dict[str, Any]:
    erro = {"codigo": codigo, "mensagem": mensagem}
    erro.update({chave: valor for chave, valor in extras.items() if valor is not None})
    return {"erro": erro}


def _nome_do_campo(local: tuple[Any, ...]) -> str:
    # ("body", "titulo") → "titulo"; ("query", "categoria", 0) → "categoria"
    partes = [str(parte) for parte in local if parte not in ("body", "query", "path")]
    return ".".join(partes) or "corpo"


def registrar_tratadores(app: FastAPI) -> None:
    @app.exception_handler(ErroApi)
    async def tratar_erro_api(_: Request, erro: ErroApi):
        atual = erro.atual.model_dump(mode="json") if erro.atual is not None else None
        return JSONResponse(
            status_code=erro.status,
            content=corpo_erro(erro.codigo, erro.mensagem, atual=atual),
            headers=erro.cabecalhos,
        )

    @app.exception_handler(RequestValidationError)
    async def tratar_validacao(_: Request, erro: RequestValidationError):
        campos = [
            {"campo": _nome_do_campo(tuple(detalhe["loc"])), "mensagem": detalhe["msg"]}
            for detalhe in erro.errors()
        ]
        return JSONResponse(
            status_code=422,
            content=corpo_erro("validacao", "Dados inválidos.", campos=campos),
        )

    @app.exception_handler(StarletteHTTPException)
    async def tratar_http(_: Request, erro: StarletteHTTPException):
        # Rotas inexistentes e métodos não suportados também seguem o formato do contrato.
        codigo, mensagem = CODIGOS_HTTP.get(erro.status_code, ("erro_http", str(erro.detail)))
        return JSONResponse(
            status_code=erro.status_code,
            content=corpo_erro(codigo, mensagem),
            headers=getattr(erro, "headers", None),
        )

    @app.middleware("http")
    async def tratar_inesperado(request: Request, proximo):
        # Middleware (e não exception_handler) para que o 500 passe pelo CORS: sem o
        # cabeçalho Access-Control-Allow-Origin o navegador esconderia o erro do front.
        try:
            return await proximo(request)
        except Exception:
            logger.exception("Erro inesperado em %s %s", request.method, request.url.path)
            return JSONResponse(
                status_code=500,
                content=corpo_erro("erro_interno", "Erro inesperado. Tente novamente."),
            )
