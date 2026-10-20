"""Cria o histórico de eventos dos incidentes.

Cada alteração grava um evento na mesma transação. Os incidentes que já existem recebem um
histórico derivado do estado atual (a mesma regra do seed, app/seed/incidentes.py): registrado
→ assumido pelo responsável → mudança para Inconclusivo ou Fechado, com datas entre a criação e
a última alteração. Assim nenhum incidente "Fechado" aparece só como "registrado".

Revision ID: 0002
Revises: 0001
Create Date: 2026-10-19
"""

from collections.abc import Sequence

import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

from alembic import op

revision: str = "0002"
down_revision: str | None = "0001"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None

tipo_evento = postgresql.ENUM(
    "criado", "assumido", "liberado", "status", "editado", name="tipo_evento"
)
status_incidente = postgresql.ENUM(name="status_incidente", create_type=False)


def upgrade() -> None:
    op.create_table(
        "eventos_incidente",
        sa.Column("id", sa.BigInteger(), sa.Identity(), primary_key=True),
        sa.Column(
            "incidente_id",
            sa.BigInteger(),
            sa.ForeignKey("incidentes.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("tipo", tipo_evento, nullable=False),
        sa.Column("analista_id", sa.BigInteger(), sa.ForeignKey("analistas.id")),
        sa.Column("status_anterior", status_incidente),
        sa.Column("status_novo", status_incidente),
        sa.Column("campos", postgresql.ARRAY(sa.String(20))),
        sa.Column(
            "criado_em", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False
        ),
    )
    op.create_index(
        "ix_eventos_incidente_linha_do_tempo", "eventos_incidente", ["incidente_id", "criado_em"]
    )
    # Ordem de inserção = ordem dos eventos (empate de data se resolve pelo id).
    op.execute(
        "INSERT INTO eventos_incidente (incidente_id, tipo, status_novo, criado_em) "
        "SELECT id, 'criado', 'aberto', criado_em FROM incidentes ORDER BY id"
    )
    duracao = "GREATEST(atualizado_em - criado_em, interval '0')"
    op.execute(
        "INSERT INTO eventos_incidente "
        "(incidente_id, tipo, analista_id, status_anterior, status_novo, criado_em) "
        "SELECT id, 'assumido', responsavel_id, 'aberto', 'em_investigacao', "
        f"criado_em + {duracao} * 0.3 FROM incidentes "
        "WHERE responsavel_id IS NOT NULL ORDER BY id"
    )
    op.execute(
        "INSERT INTO eventos_incidente "
        "(incidente_id, tipo, analista_id, status_anterior, status_novo, criado_em) "
        "SELECT id, 'status', COALESCE(responsavel_id, atualizado_por_id), 'em_investigacao', "
        f"status, criado_em + {duracao} * 0.6 FROM incidentes "
        "WHERE status IN ('inconclusivo', 'fechado') ORDER BY id"
    )


def downgrade() -> None:
    op.drop_index("ix_eventos_incidente_linha_do_tempo", table_name="eventos_incidente")
    op.drop_table("eventos_incidente")
    tipo_evento.drop(op.get_bind(), checkfirst=True)
