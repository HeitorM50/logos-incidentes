"""Frota: veículos e o motorista atual de cada um."""

from sqlalchemy import select
from sqlalchemy.orm import Session, joinedload

from app.core.erros import ErroApi
from app.models import Veiculo


def buscar_veiculo(sessao: Session, placa: str) -> Veiculo | None:
    return sessao.scalars(
        select(Veiculo).options(joinedload(Veiculo.motorista)).where(Veiculo.placa == placa)
    ).first()


def obter_veiculo(sessao: Session, placa: str) -> Veiculo:
    veiculo = buscar_veiculo(sessao, placa)
    if veiculo is None:
        raise ErroApi(404, "nao_encontrado", "Veículo não cadastrado na frota.")
    return veiculo


def completar_motorista(sessao: Session, valores: dict) -> dict:
    """Sem motorista informado, copia o motorista atual do veículo com a placa do incidente.

    Copia (e não aponta): o incidente guarda quem dirigia NAQUELE momento, mesmo que o
    veículo troque de motorista depois.
    """
    if valores.get("motorista_nome") or valores.get("motorista_telefone"):
        return valores
    placa = valores.get("placa")
    veiculo = buscar_veiculo(sessao, placa) if placa else None
    if veiculo is None or veiculo.motorista is None:
        return valores
    return valores | {
        "motorista_nome": veiculo.motorista.nome,
        "motorista_telefone": veiculo.motorista.telefone,
    }
