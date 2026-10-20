"""Possível duplicata: dois motoristas (ou o rastreador e a central) relatam o mesmo problema.

Um incidente ativo é marcado como possível duplicata do incidente ativo MAIS ANTIGO que, até
JANELA_DUPLICATA_MIN antes dele, tem a mesma placa, ou o mesmo local e a mesma categoria. A API só
aponta: quem decide (e remove ou fecha a cópia) é o analista. Nada é fundido sozinho.
"""

from datetime import timedelta

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.dominio import StatusIncidente
from app.models import Incidente
from app.services.ciclo_vida import JANELA_DUPLICATA_MIN


def _mesmo_local(a: str, b: str) -> bool:
    return " ".join(a.lower().split()) == " ".join(b.lower().split())


def parece_duplicata(atual, anterior) -> bool:
    """`anterior` é mais antigo que `atual`, ambos ativos (objetos com placa, local, categoria
    e criado_em)."""
    if atual.criado_em - anterior.criado_em > timedelta(minutes=JANELA_DUPLICATA_MIN):
        return False
    if atual.placa is not None and atual.placa == anterior.placa:
        return True
    return atual.categoria == anterior.categoria and _mesmo_local(atual.local, anterior.local)


def possiveis_duplicatas(sessao: Session) -> dict[int, int]:
    """{id do incidente: id do incidente mais antigo de que ele parece cópia}."""
    ativos = sessao.execute(
        select(
            Incidente.id, Incidente.placa, Incidente.local, Incidente.categoria, Incidente.criado_em
        )
        .where(Incidente.status != StatusIncidente.FECHADO)
        .order_by(Incidente.criado_em, Incidente.id)
    ).all()
    duplicatas: dict[int, int] = {}
    # Poucos ativos por vez (a triagem trabalha com ~100): a comparação par a par basta.
    for posicao, atual in enumerate(ativos):
        for anterior in ativos[:posicao]:  # do mais antigo para o mais novo
            if parece_duplicata(atual, anterior):
                duplicatas[atual.id] = anterior.id
                break
    return duplicatas
