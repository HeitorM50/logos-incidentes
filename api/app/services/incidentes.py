"""Regras de negócio dos incidentes.

Toda alteração passa por `_gravar_com_versao`, que aplica o controle de concorrência otimista
(ADR 0002): o UPDATE só afeta a linha se a versão no banco ainda for a que o cliente leu.
"""

from dataclasses import dataclass
from typing import Any

from sqlalchemy import case, delete, func, select, update
from sqlalchemy.orm import Session, joinedload

from app.core.dominio import Categoria, Criticidade, StatusIncidente
from app.core.erros import ErroApi
from app.models import Incidente
from app.schemas.incidente import (
    ContagemCriticidade,
    IncidenteCriar,
    IncidenteEditar,
    IncidenteResposta,
    ListaIncidentes,
)


@dataclass(frozen=True)
class FiltrosIncidentes:
    criticidades: list[Criticidade]
    categorias: list[Categoria]
    status: list[StatusIncidente]
    responsavel_id: int | None = None


def _consulta_com_relacoes():
    return select(Incidente).options(
        joinedload(Incidente.responsavel), joinedload(Incidente.atualizado_por)
    )


def _aplicar_filtros(consulta, filtros: FiltrosIncidentes, *, com_criticidade: bool = True):
    if com_criticidade and filtros.criticidades:
        consulta = consulta.where(Incidente.criticidade.in_(filtros.criticidades))
    if filtros.categorias:
        consulta = consulta.where(Incidente.categoria.in_(filtros.categorias))
    if filtros.status:
        consulta = consulta.where(Incidente.status.in_(filtros.status))
    if filtros.responsavel_id is not None:
        consulta = consulta.where(Incidente.responsavel_id == filtros.responsavel_id)
    return consulta


def listar(sessao: Session, filtros: FiltrosIncidentes) -> ListaIncidentes:
    # Ordem de triagem (ADR 0004): ativos primeiro, depois criticidade (ordem do ENUM:
    # alta → baixa) e, dentro dela, o incidente aberto há mais tempo.
    fechados_por_ultimo = case((Incidente.status == StatusIncidente.FECHADO, 1), else_=0)
    consulta = _aplicar_filtros(_consulta_com_relacoes(), filtros).order_by(
        fechados_por_ultimo, Incidente.criticidade, Incidente.criado_em, Incidente.id
    )
    itens = [IncidenteResposta.model_validate(i) for i in sessao.scalars(consulta).unique()]

    # Os contadores do topo ignoram o filtro de criticidade: mostram o total de cada nível.
    contagem = _aplicar_filtros(
        select(Incidente.criticidade, func.count()), filtros, com_criticidade=False
    ).group_by(Incidente.criticidade)
    por_criticidade = {criticidade.value: total for criticidade, total in sessao.execute(contagem)}

    return ListaIncidentes(
        itens=itens,
        total=len(itens),
        contagem_por_criticidade=ContagemCriticidade(**por_criticidade),
    )


def _buscar(sessao: Session, incidente_id: int) -> Incidente:
    consulta = _consulta_com_relacoes().where(Incidente.id == incidente_id)
    incidente = sessao.scalars(consulta.execution_options(populate_existing=True)).first()
    if incidente is None:
        raise ErroApi(404, "nao_encontrado", "Incidente não encontrado.")
    return incidente


def obter(sessao: Session, incidente_id: int) -> IncidenteResposta:
    return IncidenteResposta.model_validate(_buscar(sessao, incidente_id))


def criar(sessao: Session, dados: IncidenteCriar, analista_id: int | None) -> IncidenteResposta:
    incidente = Incidente(
        **dados.model_dump(),
        status=StatusIncidente.ABERTO,
        versao=1,
        atualizado_por_id=analista_id,
    )
    sessao.add(incidente)
    sessao.commit()
    return obter(sessao, incidente.id)


def _conflito(sessao: Session, incidente_id: int) -> ErroApi:
    atual = obter(sessao, incidente_id)
    return ErroApi(
        409,
        "conflito_versao",
        "Outro analista alterou este incidente. Confira a versão atual.",
        atual=atual,
    )


def _carregar_para_alterar(sessao: Session, incidente_id: int, versao_lida: int) -> Incidente:
    """Busca o incidente e confirma que o cliente está alterando a versão mais recente."""
    incidente = _buscar(sessao, incidente_id)
    if incidente.versao != versao_lida:
        raise _conflito(sessao, incidente_id)
    if incidente.status == StatusIncidente.FECHADO:
        raise ErroApi(422, "incidente_fechado", "Incidente fechado não pode ser alterado.")
    return incidente


def _gravar_com_versao(
    sessao: Session,
    incidente_id: int,
    versao_lida: int,
    analista_id: int | None,
    valores: dict[str, Any],
) -> IncidenteResposta:
    resultado = sessao.execute(
        update(Incidente)
        .where(Incidente.id == incidente_id, Incidente.versao == versao_lida)
        .values(
            **valores,
            versao=Incidente.versao + 1,
            atualizado_por_id=analista_id,
            atualizado_em=func.now(),
        )
        .returning(Incidente.id)
    )
    if resultado.first() is None:
        # Outra requisição gravou entre a leitura e o UPDATE.
        sessao.rollback()
        raise _conflito(sessao, incidente_id)
    sessao.commit()
    return obter(sessao, incidente_id)


def editar(
    sessao: Session, incidente_id: int, dados: IncidenteEditar, analista_id: int | None
) -> IncidenteResposta:
    _carregar_para_alterar(sessao, incidente_id, dados.versao)
    return _gravar_com_versao(sessao, incidente_id, dados.versao, analista_id, dados.alteracoes())


def remover(sessao: Session, incidente_id: int, versao_lida: int) -> None:
    incidente = _buscar(sessao, incidente_id)
    if incidente.versao != versao_lida:
        raise _conflito(sessao, incidente_id)
    resultado = sessao.execute(
        delete(Incidente)
        .where(Incidente.id == incidente_id, Incidente.versao == versao_lida)
        .returning(Incidente.id)
    )
    if resultado.first() is None:
        sessao.rollback()
        raise _conflito(sessao, incidente_id)
    sessao.commit()
