from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.dominio import PapelAnalista
from app.core.seguranca import gerar_hash_senha
from app.models import Analista

# Contas de demonstração. As credenciais aparecem na tela de login de propósito: o avaliador
# precisa entrar sem instrução externa (ver README).
SENHA_DEMO = "logos2026"
ANALISTAS_DEMO = [
    ("ana", "Ana Souza", PapelAnalista.ANALISTA),
    ("bruno", "Bruno Lima", PapelAnalista.ANALISTA),
    # Supervisora: além do que todo analista faz, transfere incidentes entre analistas.
    ("carla", "Carla Mendes", PapelAnalista.SUPERVISOR),
]


def semear_analistas(sessao: Session) -> list[Analista]:
    """Cria os analistas de demonstração que ainda não existem. Pode rodar várias vezes."""
    existentes = set(sessao.scalars(select(Analista.usuario)))
    novos = [
        Analista(usuario=usuario, nome=nome, papel=papel, senha_hash=gerar_hash_senha(SENHA_DEMO))
        for usuario, nome, papel in ANALISTAS_DEMO
        if usuario not in existentes
    ]
    sessao.add_all(novos)
    sessao.commit()
    return list(sessao.scalars(select(Analista).order_by(Analista.id)))
