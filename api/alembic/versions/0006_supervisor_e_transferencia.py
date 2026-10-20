"""Papel do analista (supervisor) e transferência de incidente.

Revision ID: 0006
Revises: 0005
Create Date: 2026-10-20
"""

from collections.abc import Sequence

import sqlalchemy as sa

from alembic import op

revision: str = "0006"
down_revision: str | None = "0005"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    papel = sa.Enum("analista", "supervisor", name="papel_analista")
    papel.create(op.get_bind())
    op.add_column(
        "analistas",
        sa.Column("papel", papel, nullable=False, server_default="analista"),
    )
    # O valor novo do enum só pode ser usado depois do commit desta migração (Postgres).
    op.execute("ALTER TYPE tipo_evento ADD VALUE IF NOT EXISTS 'transferido'")
    # Para quem o supervisor transferiu (o autor continua em analista_id).
    op.add_column(
        "eventos_incidente",
        sa.Column("responsavel_novo_id", sa.BigInteger(), sa.ForeignKey("analistas.id")),
    )


def downgrade() -> None:
    op.drop_column("eventos_incidente", "responsavel_novo_id")
    op.drop_column("analistas", "papel")
    sa.Enum(name="papel_analista").drop(op.get_bind())
    # O Postgres não remove valor de enum; 'transferido' fica no tipo tipo_evento.
