from sqlalchemy import BigInteger, Enum, Identity, String
from sqlalchemy.orm import Mapped, mapped_column

from app.core.dominio import PapelAnalista
from app.models.base import Base


class Analista(Base):
    __tablename__ = "analistas"

    id: Mapped[int] = mapped_column(BigInteger, Identity(), primary_key=True)
    nome: Mapped[str] = mapped_column(String(80))
    usuario: Mapped[str] = mapped_column(String(40), unique=True)
    senha_hash: Mapped[str] = mapped_column(String(255))
    papel: Mapped[PapelAnalista] = mapped_column(
        Enum(
            PapelAnalista,
            name="papel_analista",
            values_callable=lambda membros: [m.value for m in membros],
        ),
        default=PapelAnalista.ANALISTA,
        server_default=PapelAnalista.ANALISTA.value,
    )
