from datetime import datetime

from sqlalchemy import (
    BigInteger,
    Boolean,
    DateTime,
    ForeignKey,
    Identity,
    Index,
    String,
    UniqueConstraint,
    func,
)
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base


class Dispositivo(Base):
    """Rastreador ou app de um caminhão que envia incidentes direto para a API (ADR 0008).

    A chave fica só como hash SHA-256: ela é longa e aleatória, então um hash rápido basta e
    permite achar o dispositivo pelo próprio hash. Desativar corta o acesso sem apagar o
    histórico dos incidentes que ele enviou.
    """

    __tablename__ = "dispositivos"

    id: Mapped[int] = mapped_column(BigInteger, Identity(), primary_key=True)
    nome: Mapped[str] = mapped_column(String(80))
    placa: Mapped[str | None] = mapped_column(String(8))
    chave_hash: Mapped[str] = mapped_column(String(64), unique=True)
    ativo: Mapped[bool] = mapped_column(Boolean, default=True, server_default="true")
    criado_em: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())


class Ingestao(Base):
    """Registro de idempotência: cada Idempotency-Key de um dispositivo vira no máximo um
    incidente. A restrição UNIQUE garante isso até com dois reenvios ao mesmo tempo."""

    __tablename__ = "ingestoes"
    __table_args__ = (
        UniqueConstraint("dispositivo_id", "chave", name="uq_ingestoes_chave"),
        # Cota por dispositivo: conta os envios da última hora.
        Index("ix_ingestoes_dispositivo_criado_em", "dispositivo_id", "criado_em"),
    )

    id: Mapped[int] = mapped_column(BigInteger, Identity(), primary_key=True)
    dispositivo_id: Mapped[int] = mapped_column(ForeignKey("dispositivos.id"))
    chave: Mapped[str] = mapped_column(String(64))
    # SHA-256 do corpo: a mesma chave com outro corpo é erro do rastreador, não reenvio.
    corpo_hash: Mapped[str] = mapped_column(String(64))
    # Nulo se a central removeu o incidente depois: o reenvio não o recria.
    incidente_id: Mapped[int | None] = mapped_column(
        ForeignKey("incidentes.id", ondelete="SET NULL"), index=True
    )
    criado_em: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
