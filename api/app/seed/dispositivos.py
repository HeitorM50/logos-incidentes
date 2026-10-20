"""Dispositivo de demonstração para a ingestão pelos caminhões (ADR 0008)."""

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.dispositivo import hash_da_chave
from app.models import Dispositivo

# Chave pública de propósito, como as credenciais de demonstração da tela de login: serve para
# o avaliador testar a ingestão (scripts/simular_caminhao.py). Dispositivos reais recebem uma
# chave aleatória por `python -m app.dispositivos criar`.
CHAVE_DEMO = "demo-caminhao-logos-2026"
NOME_DEMO = "Simulador do caminhão RTA4E21"
PLACA_DEMO = "RTA4E21"


def semear_dispositivo_demo(sessao: Session) -> Dispositivo:
    """Cria o dispositivo de demonstração se ele ainda não existe (idempotente)."""
    existente = sessao.scalars(
        select(Dispositivo).where(Dispositivo.chave_hash == hash_da_chave(CHAVE_DEMO))
    ).first()
    if existente:
        return existente
    dispositivo = Dispositivo(
        nome=NOME_DEMO, placa=PLACA_DEMO, chave_hash=hash_da_chave(CHAVE_DEMO), ativo=True
    )
    sessao.add(dispositivo)
    sessao.commit()
    return dispositivo
