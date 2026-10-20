"""Regras de negócio publicadas para o front (GET /regras e web/src/api/regras.json).

O front repete algumas regras para explicar um bloqueio antes do clique (ex.: "só o
responsável muda o status") e validar o formulário antes de enviar. Para as cópias não se
afastarem do código da API, este módulo DERIVA as regras do próprio código (ciclo de vida e
schema Pydantic), o front lê o JSON gerado daqui, e um teste falha se os dois divergirem.

    uv run python -m app.regras > ../web/src/api/regras.json
"""

import json
from typing import Any

from app.core.dominio import StatusIncidente
from app.schemas.incidente import MINIMO_COMENTARIO, PADRAO_PLACA, IncidenteCriar, MudarStatus
from app.services.ciclo_vida import (
    EXIGE_COMENTARIO,
    PODE_ASSUMIR,
    PRAZO_PARA_ASSUMIR_MIN,
    TRANSICOES_DO_RESPONSAVEL,
    status_apos_liberar,
)

ORDEM = list(StatusIncidente)


def _em_ordem(status: frozenset[StatusIncidente]) -> list[str]:
    return [s.value for s in ORDEM if s in status]


def _limites(campo: str, modelo=IncidenteCriar) -> dict[str, int]:
    """minLength/maxLength do campo no schema Pydantic (também dentro de anyOf com null)."""
    esquema = modelo.model_json_schema()["properties"][campo]
    texto = next(opcao for opcao in esquema.get("anyOf", [esquema]) if "maxLength" in opcao)
    limites = {"max": texto["maxLength"]}
    if "minLength" in texto:
        limites["min"] = texto["minLength"]
    return limites


def regras() -> dict[str, Any]:
    return {
        "transicoes_do_responsavel": {
            origem.value: _em_ordem(destinos)
            for origem, destinos in sorted(
                TRANSICOES_DO_RESPONSAVEL.items(), key=lambda par: ORDEM.index(par[0])
            )
        },
        "pode_assumir": _em_ordem(PODE_ASSUMIR),
        "status_apos_liberar": {s.value: status_apos_liberar(s).value for s in ORDEM},
        # Final = não tem transição de saída e não pode ser assumido (hoje: fechado).
        "status_final": [
            s.value for s in ORDEM if s not in TRANSICOES_DO_RESPONSAVEL and s not in PODE_ASSUMIR
        ],
        "limites": {campo: _limites(campo) for campo in ("titulo", "descricao", "local")},
        "padrao_placa": PADRAO_PLACA.pattern,
        "prazo_para_assumir_min": {c.value: m for c, m in PRAZO_PARA_ASSUMIR_MIN.items()},
        "comentario": {
            **_limites("comentario", MudarStatus),
            "min": MINIMO_COMENTARIO,
            "obrigatorio_para": _em_ordem(EXIGE_COMENTARIO),
        },
    }


if __name__ == "__main__":
    print(json.dumps(regras(), ensure_ascii=False, indent=2))
