"""Telemetria da frota: última posição de cada veículo e a posição do incidente.

Revision ID: 0007
Revises: 0006
Create Date: 2026-10-20
"""

from collections.abc import Sequence

import sqlalchemy as sa

from alembic import op

revision: str = "0007"
down_revision: str | None = "0006"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.add_column("veiculos", sa.Column("latitude", sa.Float()))
    op.add_column("veiculos", sa.Column("longitude", sa.Float()))
    op.add_column("veiculos", sa.Column("velocidade_kmh", sa.SmallInteger()))
    op.add_column("veiculos", sa.Column("ignicao", sa.Boolean()))
    op.add_column("veiculos", sa.Column("referencia", sa.String(160)))
    op.add_column("veiculos", sa.Column("ultima_leitura_em", sa.DateTime(timezone=True)))
    # Desde quando está parado com a ignição ligada (regra "parado há muito tempo").
    op.add_column("veiculos", sa.Column("parado_desde", sa.DateTime(timezone=True)))
    op.add_column("incidentes", sa.Column("latitude", sa.Float()))
    op.add_column("incidentes", sa.Column("longitude", sa.Float()))


def downgrade() -> None:
    op.drop_column("incidentes", "longitude")
    op.drop_column("incidentes", "latitude")
    for coluna in (
        "parado_desde",
        "ultima_leitura_em",
        "referencia",
        "ignicao",
        "velocidade_kmh",
        "longitude",
        "latitude",
    ):
        op.drop_column("veiculos", coluna)
