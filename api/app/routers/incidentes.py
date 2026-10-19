from typing import Annotated

from fastapi import APIRouter, Depends, Query, Response, status

from app.core.autenticacao import AnalistaAtualDep, obter_analista_atual
from app.core.banco import SessaoDep
from app.core.dominio import Categoria, Criticidade, StatusIncidente
from app.schemas.incidente import (
    IncidenteCriar,
    IncidenteEditar,
    IncidenteResposta,
    ListaIncidentes,
)
from app.services import incidentes as servico
from app.services.incidentes import FiltrosIncidentes

# Todas as rotas de incidentes exigem um analista autenticado.
router = APIRouter(
    prefix="/incidentes", tags=["incidentes"], dependencies=[Depends(obter_analista_atual)]
)


@router.get("", response_model=ListaIncidentes, summary="Lista incidentes em ordem de triagem")
def listar_incidentes(
    sessao: SessaoDep,
    criticidade: Annotated[list[Criticidade], Query()] = [],  # noqa: B006
    categoria: Annotated[list[Categoria], Query()] = [],  # noqa: B006
    status_: Annotated[list[StatusIncidente], Query(alias="status")] = [],  # noqa: B006
):
    filtros = FiltrosIncidentes(criticidades=criticidade, categorias=categoria, status=status_)
    return servico.listar(sessao, filtros)


@router.get("/{incidente_id}", response_model=IncidenteResposta, summary="Detalha um incidente")
def obter_incidente(incidente_id: int, sessao: SessaoDep):
    return servico.obter(sessao, incidente_id)


@router.post(
    "",
    response_model=IncidenteResposta,
    status_code=status.HTTP_201_CREATED,
    summary="Registra um incidente",
)
def criar_incidente(dados: IncidenteCriar, sessao: SessaoDep, analista: AnalistaAtualDep):
    return servico.criar(sessao, dados, analista.id)


@router.patch("/{incidente_id}", response_model=IncidenteResposta, summary="Edita um incidente")
def editar_incidente(
    incidente_id: int, dados: IncidenteEditar, sessao: SessaoDep, analista: AnalistaAtualDep
):
    return servico.editar(sessao, incidente_id, dados, analista.id)


@router.delete(
    "/{incidente_id}", status_code=status.HTTP_204_NO_CONTENT, summary="Remove um incidente"
)
def remover_incidente(incidente_id: int, sessao: SessaoDep, versao: Annotated[int, Query(ge=1)]):
    servico.remover(sessao, incidente_id, versao)
    return Response(status_code=status.HTTP_204_NO_CONTENT)
