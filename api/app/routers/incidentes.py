from typing import Annotated, Literal

from fastapi import APIRouter, Depends, Path, Query, Response, status

from app.core.autenticacao import AnalistaAtualDep, obter_analista_atual
from app.core.banco import SessaoDep
from app.core.dominio import Categoria, Criticidade, StatusIncidente
from app.schemas.incidente import (
    MAXIMO_BIGINT,
    MAXIMO_INTEGER,
    EventoResposta,
    IncidenteCriar,
    IncidenteEditar,
    IncidenteResposta,
    ListaIncidentes,
    MudarStatus,
    VersaoLida,
)
from app.services import incidentes as servico
from app.services.incidentes import FiltrosIncidentes

IdIncidente = Annotated[int, Path(ge=1, le=MAXIMO_BIGINT)]

# Todas as rotas de incidentes exigem um analista autenticado.
router = APIRouter(
    prefix="/incidentes", tags=["incidentes"], dependencies=[Depends(obter_analista_atual)]
)


@router.get("", response_model=ListaIncidentes, summary="Lista incidentes em ordem de triagem")
def listar_incidentes(
    sessao: SessaoDep,
    analista: AnalistaAtualDep,
    criticidade: Annotated[list[Criticidade], Query()] = [],  # noqa: B006
    categoria: Annotated[list[Categoria], Query()] = [],  # noqa: B006
    status_: Annotated[list[StatusIncidente], Query(alias="status")] = [],  # noqa: B006
    responsavel: Annotated[
        Literal["eu"] | None, Query(description="`eu` lista só os incidentes assumidos por mim")
    ] = None,
):
    filtros = FiltrosIncidentes(
        criticidades=criticidade,
        categorias=categoria,
        status=status_,
        responsavel_id=analista.id if responsavel == "eu" else None,
    )
    return servico.listar(sessao, filtros)


@router.get("/{incidente_id}", response_model=IncidenteResposta, summary="Detalha um incidente")
def obter_incidente(incidente_id: IdIncidente, sessao: SessaoDep):
    return servico.obter(sessao, incidente_id)


@router.post(
    "",
    response_model=IncidenteResposta,
    status_code=status.HTTP_201_CREATED,
    summary="Registra um incidente",
)
def criar_incidente(dados: IncidenteCriar, sessao: SessaoDep, analista: AnalistaAtualDep):
    return servico.criar(sessao, dados, analista.id)


@router.get(
    "/{incidente_id}/eventos",
    response_model=list[EventoResposta],
    summary="Histórico do incidente, do mais antigo ao mais novo",
)
def listar_eventos(incidente_id: IdIncidente, sessao: SessaoDep):
    return servico.listar_eventos(sessao, incidente_id)


@router.patch("/{incidente_id}", response_model=IncidenteResposta, summary="Edita um incidente")
def editar_incidente(
    incidente_id: IdIncidente, dados: IncidenteEditar, sessao: SessaoDep, analista: AnalistaAtualDep
):
    return servico.editar(sessao, incidente_id, dados, analista.id)


@router.delete(
    "/{incidente_id}", status_code=status.HTTP_204_NO_CONTENT, summary="Remove um incidente"
)
def remover_incidente(
    incidente_id: IdIncidente,
    sessao: SessaoDep,
    analista: AnalistaAtualDep,
    versao: Annotated[int, Query(ge=1, le=MAXIMO_INTEGER)],
):
    servico.remover(sessao, incidente_id, versao, analista.id)
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.post(
    "/{incidente_id}/assumir",
    response_model=IncidenteResposta,
    summary="Assume o incidente e inicia a investigação",
)
def assumir_incidente(
    incidente_id: IdIncidente, dados: VersaoLida, sessao: SessaoDep, analista: AnalistaAtualDep
):
    return servico.assumir(sessao, incidente_id, dados.versao, analista.id)


@router.post(
    "/{incidente_id}/liberar",
    response_model=IncidenteResposta,
    summary="Libera o incidente para outro analista",
)
def liberar_incidente(
    incidente_id: IdIncidente, dados: VersaoLida, sessao: SessaoDep, analista: AnalistaAtualDep
):
    return servico.liberar(sessao, incidente_id, dados.versao, analista.id)


@router.post(
    "/{incidente_id}/status",
    response_model=IncidenteResposta,
    summary="Muda o status (somente o responsável)",
)
def mudar_status_incidente(
    incidente_id: IdIncidente, dados: MudarStatus, sessao: SessaoDep, analista: AnalistaAtualDep
):
    return servico.mudar_status(sessao, incidente_id, dados.versao, dados.status, analista.id)
