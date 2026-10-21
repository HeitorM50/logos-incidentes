from datetime import datetime

from sqlalchemy import (
    BigInteger,
    Boolean,
    DateTime,
    Float,
    ForeignKey,
    Identity,
    SmallInteger,
    String,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base


class Motorista(Base):
    """Motorista da frota. O telefone é dado pessoal: só sai pela API autenticada."""

    __tablename__ = "motoristas"

    id: Mapped[int] = mapped_column(BigInteger, Identity(), primary_key=True)
    nome: Mapped[str] = mapped_column(String(80))
    # Formato E.164 sem espaços: +5511987654321.
    telefone: Mapped[str] = mapped_column(String(16))


class Veiculo(Base):
    """Caminhão da frota. `motorista` é quem dirige agora (muda a cada viagem ou turno)."""

    __tablename__ = "veiculos"

    id: Mapped[int] = mapped_column(BigInteger, Identity(), primary_key=True)
    placa: Mapped[str] = mapped_column(String(8), unique=True)
    modelo: Mapped[str] = mapped_column(String(60))
    motorista_id: Mapped[int | None] = mapped_column(ForeignKey("motoristas.id"))
    # Última leitura da telemetria (POST /telemetria).
    latitude: Mapped[float | None] = mapped_column(Float)
    longitude: Mapped[float | None] = mapped_column(Float)
    velocidade_kmh: Mapped[int | None] = mapped_column(SmallInteger)
    ignicao: Mapped[bool | None] = mapped_column(Boolean)
    referencia: Mapped[str | None] = mapped_column(String(160))
    ultima_leitura_em: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    parado_desde: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))

    motorista: Mapped[Motorista | None] = relationship()
