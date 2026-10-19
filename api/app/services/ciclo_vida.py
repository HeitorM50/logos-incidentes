"""Máquina de estados do incidente (docs/contrato-api.md#ciclo-de-vida-do-status).

aberto ──assumir──► em_investigacao ◄──► inconclusivo
   ▲                    │      │               │
   └──── liberar ───────┘      └──► fechado ◄──┘   (fechado é final)
"""

from app.core.dominio import StatusIncidente as S

# Transições que o responsável faz pela rota de status.
TRANSICOES_DO_RESPONSAVEL: dict[S, frozenset[S]] = {
    S.EM_INVESTIGACAO: frozenset({S.INCONCLUSIVO, S.FECHADO}),
    S.INCONCLUSIVO: frozenset({S.EM_INVESTIGACAO, S.FECHADO}),
}

# Status a partir dos quais um analista pode assumir o incidente.
PODE_ASSUMIR: frozenset[S] = frozenset({S.ABERTO, S.INCONCLUSIVO})


def transicao_permitida(atual: S, novo: S) -> bool:
    return novo in TRANSICOES_DO_RESPONSAVEL.get(atual, frozenset())


def status_apos_liberar(atual: S) -> S:
    # Sem responsável, a investigação volta para a fila de abertos.
    return S.ABERTO if atual == S.EM_INVESTIGACAO else atual
