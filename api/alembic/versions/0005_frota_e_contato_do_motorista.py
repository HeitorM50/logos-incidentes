"""Frota (veículos e motoristas) e a cópia do contato do motorista no incidente.

Revision ID: 0005
Revises: 0004
Create Date: 2026-10-20
"""

from collections.abc import Sequence

import sqlalchemy as sa

from alembic import op

revision: str = "0005"
down_revision: str | None = "0004"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        "motoristas",
        sa.Column("id", sa.BigInteger(), sa.Identity(), primary_key=True),
        sa.Column("nome", sa.String(80), nullable=False),
        sa.Column("telefone", sa.String(16), nullable=False),
    )
    op.create_table(
        "veiculos",
        sa.Column("id", sa.BigInteger(), sa.Identity(), primary_key=True),
        sa.Column("placa", sa.String(8), nullable=False, unique=True),
        sa.Column("modelo", sa.String(60), nullable=False),
        sa.Column("motorista_id", sa.BigInteger(), sa.ForeignKey("motoristas.id")),
    )
    # Cópia no incidente: o histórico continua certo quando o motorista do veículo muda.
    op.add_column("incidentes", sa.Column("motorista_nome", sa.String(80)))
    op.add_column("incidentes", sa.Column("motorista_telefone", sa.String(16)))


def downgrade() -> None:
    op.drop_column("incidentes", "motorista_telefone")
    op.drop_column("incidentes", "motorista_nome")
    op.drop_table("veiculos")
    op.drop_table("motoristas")
