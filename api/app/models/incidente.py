from datetime import datetime

from sqlalchemy import (
    BigInteger,
    DateTime,
    Enum,
    ForeignKey,
    Identity,
    Index,
    Integer,
    String,
    Text,
    func,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.dominio import Categoria, Criticidade, StatusIncidente
from app.models.analista import Analista
from app.models.base import Base


def _enum_postgres(enum_python, nome: str) -> Enum:
    """Grava o valor do enum (ex.: 'alta'), não o nome do membro (ex.: 'ALTA')."""
    return Enum(enum_python, name=nome, values_callable=lambda membros: [m.value for m in membros])


class Incidente(Base):
    __tablename__ = "incidentes"
    __table_args__ = (
        # Atende a listagem de triagem: filtro por status, ordem por criticidade e idade.
        Index("ix_incidentes_triagem", "status", "criticidade", "criado_em"),
    )

    id: Mapped[int] = mapped_column(BigInteger, Identity(), primary_key=True)
    titulo: Mapped[str] = mapped_column(String(120))
    descricao: Mapped[str | None] = mapped_column(Text)
    categoria: Mapped[Categoria] = mapped_column(_enum_postgres(Categoria, "categoria"))
    criticidade: Mapped[Criticidade] = mapped_column(_enum_postgres(Criticidade, "criticidade"))
    status: Mapped[StatusIncidente] = mapped_column(
        _enum_postgres(StatusIncidente, "status_incidente"), default=StatusIncidente.ABERTO
    )
    local: Mapped[str] = mapped_column(String(160))
    placa: Mapped[str | None] = mapped_column(String(8))
    responsavel_id: Mapped[int | None] = mapped_column(ForeignKey("analistas.id"))
    atualizado_por_id: Mapped[int | None] = mapped_column(ForeignKey("analistas.id"))
    # Controle de concorrência otimista (ADR 0002).
    versao: Mapped[int] = mapped_column(Integer, default=1)
    criado_em: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    atualizado_em: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )

    responsavel: Mapped[Analista | None] = relationship(foreign_keys=[responsavel_id])
    atualizado_por: Mapped[Analista | None] = relationship(foreign_keys=[atualizado_por_id])
