"""Cria as tabelas de analistas e incidentes.

Revision ID: 0001
Revises:
Create Date: 2026-10-19
"""

from collections.abc import Sequence

import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

from alembic import op

revision: str = "0001"
down_revision: str | None = None
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None

categoria = postgresql.ENUM(
    "acidente_veiculo",
    "acidente_vitimas",
    "condicao_climatica",
    "problema_mecanico",
    "bloqueio_pista",
    name="categoria",
)
criticidade = postgresql.ENUM("alta", "media", "baixa", name="criticidade")
status_incidente = postgresql.ENUM(
    "aberto", "em_investigacao", "inconclusivo", "fechado", name="status_incidente"
)


def upgrade() -> None:
    op.create_table(
        "analistas",
        sa.Column("id", sa.BigInteger(), sa.Identity(), primary_key=True),
        sa.Column("nome", sa.String(80), nullable=False),
        sa.Column("usuario", sa.String(40), nullable=False, unique=True),
        sa.Column("senha_hash", sa.String(255), nullable=False),
    )
    op.create_table(
        "incidentes",
        sa.Column("id", sa.BigInteger(), sa.Identity(), primary_key=True),
        sa.Column("titulo", sa.String(120), nullable=False),
        sa.Column("descricao", sa.Text(), nullable=True),
        sa.Column("categoria", categoria, nullable=False),
        sa.Column("criticidade", criticidade, nullable=False),
        sa.Column("status", status_incidente, nullable=False),
        sa.Column("local", sa.String(160), nullable=False),
        sa.Column("placa", sa.String(8), nullable=True),
        sa.Column("responsavel_id", sa.BigInteger(), sa.ForeignKey("analistas.id")),
        sa.Column("atualizado_por_id", sa.BigInteger(), sa.ForeignKey("analistas.id")),
        sa.Column("versao", sa.Integer(), nullable=False),
        sa.Column(
            "criado_em", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False
        ),
        sa.Column(
            "atualizado_em",
            sa.DateTime(timezone=True),
            server_default=sa.func.now(),
            nullable=False,
        ),
    )
    op.create_index("ix_incidentes_triagem", "incidentes", ["status", "criticidade", "criado_em"])


def downgrade() -> None:
    op.drop_index("ix_incidentes_triagem", table_name="incidentes")
    op.drop_table("incidentes")
    op.drop_table("analistas")
    status_incidente.drop(op.get_bind())
    criticidade.drop(op.get_bind())
    categoria.drop(op.get_bind())
