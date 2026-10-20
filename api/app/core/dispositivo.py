"""Autenticação dos caminhões na ingestão (ADR 0008)."""

import hashlib
from typing import Annotated

from fastapi import Depends, Header, Request
from limits import parse
from sqlalchemy import select

from app.core.banco import SessaoDep
from app.core.erros import ErroApi
from app.core.limite import ip_do_cliente, limitador
from app.models import Dispositivo

CABECALHO_CHAVE = "X-Chave-Dispositivo"


def hash_da_chave(chave: str) -> str:
    """SHA-256 em hexadecimal. A chave é longa e aleatória: não precisa de bcrypt."""
    return hashlib.sha256(chave.encode()).hexdigest()


LIMITE_POR_IP = parse("60/minute")


def limitar_por_ip(request: Request) -> None:
    """60 envios por minuto por IP, contados ANTES de autenticar: chave errada e corpo
    inválido também contam (senão o limite não protegeria contra força bruta)."""
    if limitador.enabled and not limitador.limiter.hit(
        LIMITE_POR_IP, "ingestao", ip_do_cliente(request)
    ):
        raise ErroApi(
            429,
            "muitas_tentativas",
            "Muitos envios deste endereço. Aguarde um minuto.",
            cabecalhos={"Retry-After": "60"},
        )


def obter_dispositivo(
    _limite: Annotated[None, Depends(limitar_por_ip)],
    sessao: SessaoDep,
    chave: Annotated[
        str | None,
        Header(
            alias=CABECALHO_CHAVE,
            description="Chave do dispositivo (caminhão), entregue uma vez na criação.",
        ),
    ] = None,
) -> Dispositivo:
    if not chave:
        raise ErroApi(401, "nao_autenticado", "Envie a chave do dispositivo.")
    dispositivo = sessao.scalars(
        select(Dispositivo).where(Dispositivo.chave_hash == hash_da_chave(chave))
    ).first()
    # Chave desconhecida e dispositivo desativado têm a mesma resposta: não revela qual é.
    if dispositivo is None or not dispositivo.ativo:
        raise ErroApi(401, "nao_autenticado", "Dispositivo não autorizado.")
    return dispositivo


DispositivoDep = Annotated[Dispositivo, Depends(obter_dispositivo)]
