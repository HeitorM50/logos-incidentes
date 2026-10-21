"""Frota: veículos e o motorista atual de cada um."""

from sqlalchemy import case, select
from sqlalchemy.orm import Session, joinedload

from app.core.dominio import Criticidade, StatusIncidente
from app.core.erros import ErroApi
from app.models import Incidente, Veiculo
from app.schemas.frota import IncidenteDoVeiculo, MapaDaFrota, PosicaoVeiculo, RotaDoMapa
from app.simulacao.rotas import ROTAS


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


def mapa(sessao: Session) -> MapaDaFrota:
    """Rodovias da simulação e a posição de cada caminhão, com o incidente ativo dele."""
    veiculos = sessao.scalars(
        select(Veiculo).options(joinedload(Veiculo.motorista)).order_by(Veiculo.placa)
    ).all()
    ordem = case(
        (Incidente.criticidade == Criticidade.ALTA, 0),
        (Incidente.criticidade == Criticidade.MEDIA, 1),
        else_=2,
    )
    ativos = sessao.execute(
        select(Incidente.placa, Incidente.id, Incidente.titulo, Incidente.criticidade)
        .where(Incidente.status != StatusIncidente.FECHADO, Incidente.placa.is_not(None))
        .order_by(ordem, Incidente.criado_em)
    ).all()
    incidente_da_placa: dict[str, IncidenteDoVeiculo] = {}
    for linha in ativos:
        incidente_da_placa.setdefault(
            linha.placa,
            IncidenteDoVeiculo(id=linha.id, titulo=linha.titulo, criticidade=linha.criticidade),
        )
    return MapaDaFrota(
        rotas=[
            RotaDoMapa(rodovia=r.rodovia, pontos=[(p.lat, p.lon) for p in r.pontos]) for r in ROTAS
        ],
        veiculos=[
            PosicaoVeiculo(
                placa=v.placa,
                modelo=v.modelo,
                motorista=v.motorista.nome if v.motorista else None,
                latitude=v.latitude,
                longitude=v.longitude,
                velocidade_kmh=v.velocidade_kmh,
                ignicao=v.ignicao,
                referencia=v.referencia,
                ultima_leitura_em=v.ultima_leitura_em,
                parado_desde=v.parado_desde,
                incidente=incidente_da_placa.get(v.placa),
            )
            for v in veiculos
        ],
    )
