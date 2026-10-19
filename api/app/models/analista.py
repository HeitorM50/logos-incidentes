from sqlalchemy import BigInteger, Identity, String
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base


class Analista(Base):
    __tablename__ = "analistas"

    id: Mapped[int] = mapped_column(BigInteger, Identity(), primary_key=True)
    nome: Mapped[str] = mapped_column(String(80))
    usuario: Mapped[str] = mapped_column(String(40), unique=True)
    senha_hash: Mapped[str] = mapped_column(String(255))
