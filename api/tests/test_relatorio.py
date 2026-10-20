"""Relatório: funil, tempos médios e comparação com o período anterior, a partir do histórico."""

from datetime import timedelta

from fastapi.testclient import TestClient
from sqlalchemy import update
from sqlalchemy.orm import Session

from app.models import EventoIncidente, Incidente
from tests.apoio import acao, criar_incidente


def recuar(sessao: Session, incidente: dict, minutos: int) -> None:
    """Faz o incidente (e o histórico dele) ter acontecido `minutos` antes."""
    delta = timedelta(minutes=minutos)
    sessao.execute(
        update(Incidente)
        .where(Incidente.id == incidente["id"])
        .values(criado_em=Incidente.criado_em - delta)
    )
    sessao.execute(
        update(EventoIncidente)
        .where(EventoIncidente.incidente_id == incidente["id"], EventoIncidente.tipo == "criado")
        .values(criado_em=EventoIncidente.criado_em - delta)
    )
    sessao.commit()


def test_funil_e_tempos_do_periodo(cliente: TestClient, sessao: Session):
    # Alta assumido 30 min depois de aberto (prazo 15): assumido, mas fora do prazo.
    alta = criar_incidente(cliente, criticidade="alta")
    recuar(sessao, alta, 30)
    alta = acao(cliente, alta, "assumir").json()
    # Baixa assumido na hora e fechado.
    baixa = acao(cliente, criar_incidente(cliente, criticidade="baixa"), "assumir").json()
    acao(cliente, baixa, "status", status="fechado")
    # Média sem ninguém, ainda no prazo (60 min).
    criar_incidente(cliente, criticidade="media")

    resposta = cliente.get("/relatorio", params={"horas": 6})
    assert resposta.status_code == 200, resposta.text
    relatorio = resposta.json()

    assert [(e["etapa"], e["quantidade"]) for e in relatorio["funil"]] == [
        ("Recebidos", 3),
        ("Assumidos", 2),
        ("Assumidos no prazo", 1),
        ("Fechados", 1),
    ]
    assert relatorio["recebidos"] == {"atual": 3, "anterior": 0}
    assert relatorio["alta"]["atual"] == 1
    assert 14 <= relatorio["tempo_ate_assumir_min"]["atual"] <= 16  # (30 + 0) / 2
    assert relatorio["taxa_atraso_pct"]["atual"] == round(100 / 3, 1)
    assert len(relatorio["serie"]) == 6
    assert sum(p["total"] for p in relatorio["serie"]) == 3


def test_periodo_anterior_entra_na_comparacao(cliente: TestClient, sessao: Session):
    antigo = criar_incidente(cliente)
    recuar(sessao, antigo, 8 * 60)  # entre 6 h e 12 h atrás
    criar_incidente(cliente)

    relatorio = cliente.get("/relatorio", params={"horas": 6}).json()

    assert relatorio["recebidos"] == {"atual": 1, "anterior": 1}


def test_periodo_invalido_e_login(cliente: TestClient, cliente_anonimo: TestClient):
    assert cliente.get("/relatorio", params={"horas": 5}).status_code == 422
    assert cliente_anonimo.get("/relatorio").status_code == 401
