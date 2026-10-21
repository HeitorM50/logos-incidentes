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


def test_registro_traz_recebidos_fechados_e_a_linha_do_tempo(cliente: TestClient, sessao: Session):
    # Chegou há 8 h (fora das últimas 6 h), mas fechou agora: entra no registro.
    antigo = criar_incidente(cliente, titulo="Pneu estourado antigo")
    recuar(sessao, antigo, 8 * 60)
    antigo = acao(cliente, antigo, "assumir").json()
    acao(cliente, antigo, "status", status="fechado", comentario="Borracheiro trocou o pneu")
    novo = criar_incidente(cliente, titulo="Neblina na serra", placa="RTA4E21")

    resposta = cliente.get("/relatorio/registro", params={"horas": 6})

    assert resposta.status_code == 200
    corpo = resposta.json()
    linhas = {i["id"]: i for i in corpo["incidentes"]}
    assert set(linhas) == {antigo["id"], novo["id"]}
    assert linhas[antigo["id"]]["comentario_fechamento"] == "Borracheiro trocou o pneu"
    assert linhas[antigo["id"]]["fechado_em"] is not None
    assert linhas[novo["id"]]["origem"] == "Central"
    # Linha do tempo só do período: o registro do antigo (há 8 h) fica fora.
    tipos = [(e["incidente_id"], e["tipo"]) for e in corpo["eventos"]]
    assert (antigo["id"], "criado") not in tipos
    assert (antigo["id"], "status") in tipos
    assert (novo["id"], "criado") in tipos
    assert {e["incidente_titulo"] for e in corpo["eventos"]} == {
        "Pneu estourado antigo",
        "Neblina na serra",
    }


def test_atraso_do_periodo_anterior_e_medido_ate_o_fim_dele(cliente: TestClient, sessao: Session):
    # Média (prazo 60 min) aberta 6 h 30 min atrás, sem ninguém: no fim do período anterior
    # (6 h atrás) estava com 30 min, ainda no prazo. Só passa do prazo dentro do período atual.
    antigo = criar_incidente(cliente, criticidade="media")
    recuar(sessao, antigo, 6 * 60 + 30)

    relatorio = cliente.get("/relatorio", params={"horas": 6}).json()

    assert relatorio["taxa_atraso_pct"]["anterior"] == 0
