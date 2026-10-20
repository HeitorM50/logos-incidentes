from enum import StrEnum


class Categoria(StrEnum):
    ACIDENTE_VEICULO = "acidente_veiculo"
    ACIDENTE_VITIMAS = "acidente_vitimas"
    CONDICAO_CLIMATICA = "condicao_climatica"
    PROBLEMA_MECANICO = "problema_mecanico"
    BLOQUEIO_PISTA = "bloqueio_pista"


class Criticidade(StrEnum):
    # A ordem de declaração define a ordem do ENUM no Postgres: alta < media < baixa.
    ALTA = "alta"
    MEDIA = "media"
    BAIXA = "baixa"


class StatusIncidente(StrEnum):
    ABERTO = "aberto"
    EM_INVESTIGACAO = "em_investigacao"
    INCONCLUSIVO = "inconclusivo"
    FECHADO = "fechado"


class TipoEvento(StrEnum):
    """O que aconteceu com o incidente, para o histórico (eventos_incidente)."""

    CRIADO = "criado"
    ASSUMIDO = "assumido"
    LIBERADO = "liberado"
    STATUS = "status"
    EDITADO = "editado"
    TRANSFERIDO = "transferido"


class PapelAnalista(StrEnum):
    """Supervisor pode transferir incidentes entre analistas; o resto é igual para todos."""

    ANALISTA = "analista"
    SUPERVISOR = "supervisor"
