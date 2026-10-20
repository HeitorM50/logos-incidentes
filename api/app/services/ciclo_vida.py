"""Máquina de estados do incidente (docs/contrato-api.md#ciclo-de-vida-do-status).

aberto ──assumir──► em_investigacao ◄──► inconclusivo
   ▲                    │      │               │
   └──── liberar ───────┘      └──► fechado ◄──┘   (fechado é final)
"""

from app.core.dominio import Criticidade as C
from app.core.dominio import StatusIncidente as S

# Transições que o responsável faz pela rota de status.
TRANSICOES_DO_RESPONSAVEL: dict[S, frozenset[S]] = {
    S.EM_INVESTIGACAO: frozenset({S.INCONCLUSIVO, S.FECHADO}),
    S.INCONCLUSIVO: frozenset({S.EM_INVESTIGACAO, S.FECHADO}),
}

# Status que pedem comentário: como o incidente foi resolvido, ou por que ficou inconclusivo.
# Sem ele, o histórico diz que o incidente fechou, mas não diz por quê.
EXIGE_COMENTARIO: frozenset[S] = frozenset({S.INCONCLUSIVO, S.FECHADO})

# Prazo para alguém assumir, em minutos, por criticidade. Incidente ativo sem responsável além
# do prazo está ATRASADO: é a exceção que a triagem destaca (o que está sendo esquecido).
PRAZO_PARA_ASSUMIR_MIN: dict[C, int] = {C.ALTA: 15, C.MEDIA: 60, C.BAIXA: 240}

# Janela para apontar possível duplicata (services/duplicatas.py): mesma placa, ou mesmo local e
# categoria, aberto até este tempo depois de outro incidente ativo.
JANELA_DUPLICATA_MIN = 120

# Status a partir dos quais um analista pode assumir o incidente.
PODE_ASSUMIR: frozenset[S] = frozenset({S.ABERTO, S.INCONCLUSIVO})


def transicao_permitida(atual: S, novo: S) -> bool:
    return novo in TRANSICOES_DO_RESPONSAVEL.get(atual, frozenset())


def status_apos_liberar(atual: S) -> S:
    # Sem responsável, a investigação volta para a fila de abertos.
    return S.ABERTO if atual == S.EM_INVESTIGACAO else atual
