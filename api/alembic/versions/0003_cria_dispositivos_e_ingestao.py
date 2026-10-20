"""Cria dispositivos (caminhões) e o registro de idempotência da ingestão.

Revision ID: 0003
Revises: 0002
Create Date: 2026-10-20
"""

from collections.abc import Sequence

import sqlalchemy as sa

from alembic import op

revision: str = "0003"
down_revision: str | None = "0002"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        "dispositivos",
        sa.Column("id", sa.BigInteger(), sa.Identity(), primary_key=True),
        sa.Column("nome", sa.String(80), nullable=False),
        sa.Column("placa", sa.String(8)),
        sa.Column("chave_hash", sa.String(64), nullable=False, unique=True),
        sa.Column("ativo", sa.Boolean(), nullable=False, server_default=sa.true()),
        sa.Column(
            "criado_em", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False
        ),
    )
    op.create_table(
        "ingestoes",
        sa.Column("id", sa.BigInteger(), sa.Identity(), primary_key=True),
        sa.Column(
            "dispositivo_id", sa.BigInteger(), sa.ForeignKey("dispositivos.id"), nullable=False
        ),
        sa.Column("chave", sa.String(64), nullable=False),
        sa.Column("corpo_hash", sa.String(64), nullable=False),
        sa.Column(
            "incidente_id",
            sa.BigInteger(),
            sa.ForeignKey("incidentes.id", ondelete="SET NULL"),
        ),
        sa.Column(
            "criado_em", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False
        ),
        sa.UniqueConstraint("dispositivo_id", "chave", name="uq_ingestoes_chave"),
    )
    op.create_index("ix_ingestoes_incidente_id", "ingestoes", ["incidente_id"])
    op.create_index(
        "ix_ingestoes_dispositivo_criado_em", "ingestoes", ["dispositivo_id", "criado_em"]
    )
    op.add_column(
        "incidentes",
        sa.Column("dispositivo_id", sa.BigInteger(), sa.ForeignKey("dispositivos.id")),
    )
    op.create_index("ix_incidentes_dispositivo_id", "incidentes", ["dispositivo_id"])


def downgrade() -> None:
    op.drop_index("ix_incidentes_dispositivo_id", table_name="incidentes")
    op.drop_column("incidentes", "dispositivo_id")
    op.drop_table("ingestoes")
    op.drop_table("dispositivos")
