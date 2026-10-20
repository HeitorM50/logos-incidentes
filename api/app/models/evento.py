from datetime import datetime

from sqlalchemy import ARRAY, BigInteger, DateTime, Enum, ForeignKey, Identity, Index, String, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.dominio import StatusIncidente, TipoEvento
from app.models.analista import Analista
from app.models.base import Base


def _enum_postgres(enum_python, nome: str, criar: bool = True) -> Enum:
    """Grava o valor do enum (ex.: 'assumido'), não o nome do membro (ex.: 'ASSUMIDO')."""
    return Enum(
        enum_python,
        name=nome,
        values_callable=lambda membros: [m.value for m in membros],
        create_type=criar,
    )


class EventoIncidente(Base):
    """Linha do histórico. Gravada na mesma transação da alteração que ela descreve."""

    __tablename__ = "eventos_incidente"
    __table_args__ = (Index("ix_eventos_incidente_linha_do_tempo", "incidente_id", "criado_em"),)

    id: Mapped[int] = mapped_column(BigInteger, Identity(), primary_key=True)
    # Remover o incidente remove o histórico dele.
    incidente_id: Mapped[int] = mapped_column(ForeignKey("incidentes.id", ondelete="CASCADE"))
    tipo: Mapped[TipoEvento] = mapped_column(_enum_postgres(TipoEvento, "tipo_evento"))
    # Nulo nos eventos de origem externa (seed, registros anteriores ao histórico).
    analista_id: Mapped[int | None] = mapped_column(ForeignKey("analistas.id"))
    # O tipo status_incidente já existe (criado com a tabela incidentes).
    status_anterior: Mapped[StatusIncidente | None] = mapped_column(
        _enum_postgres(StatusIncidente, "status_incidente", criar=False)
    )
    status_novo: Mapped[StatusIncidente | None] = mapped_column(
        _enum_postgres(StatusIncidente, "status_incidente", criar=False)
    )
    # Campos alterados numa edição (ex.: ["titulo", "local"]).
    campos: Mapped[list[str] | None] = mapped_column(ARRAY(String(20)))
    criado_em: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    analista: Mapped[Analista | None] = relationship()
