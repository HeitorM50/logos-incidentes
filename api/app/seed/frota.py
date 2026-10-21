"""Frota de demonstração: 70 caminhões, cada um com o motorista atual.

Nomes inventados. Os telefones usam o DDD 10, que não existe no Brasil: nenhum número da
demonstração toca o telefone de uma pessoa real, nem pelo botão "Ligar", nem pelo WhatsApp.
"""

import random
from datetime import UTC, datetime

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.models import Motorista, Veiculo
from app.simulacao.frota import estado_do_caminhao


def _gerar_placa(gerador: random.Random) -> str:
    letras = "ABCDEFGHIJKLMNOPQRSTUVWXYZ"
    return (
        "".join(gerador.choices(letras, k=3))
        + str(gerador.randint(0, 9))
        + gerador.choice(letras)
        + f"{gerador.randint(0, 99):02d}"
    )


# Placas Mercosul fictícias. Os incidentes do seed sorteiam a placa daqui, então o mesmo caminhão
# aparece em mais de um incidente (problema recorrente), como numa frota real. Gerador próprio:
# a frota não muda quando o sorteio dos incidentes muda. A primeira é a do simulador.
_gerador_frota = random.Random(2026)
PLACAS_DA_FROTA: list[str] = ["RTA4E21"] + [_gerar_placa(_gerador_frota) for _ in range(69)]

NOMES = [
    "Adriano", "Aline", "Anderson", "Beatriz", "Carlos", "Cláudio", "Daniel", "Edson",
    "Fabiana", "Fernando", "Gilberto", "Hélio", "Ivone", "Jair", "Joana", "José", "Juliano",
    "Kátia", "Leandro", "Luciana", "Marcelo", "Márcia", "Nilton", "Osvaldo", "Patrícia",
    "Reginaldo", "Renata", "Roberto", "Sandro", "Sebastião", "Silvana", "Valdir", "Wagner",
]  # fmt: skip
SOBRENOMES = [
    "Almeida", "Barbosa", "Cardoso", "Costa", "Dias", "Ferreira", "Gomes", "Lima", "Lopes",
    "Martins", "Melo", "Moreira", "Nunes", "Oliveira", "Pereira", "Ramos", "Rocha", "Santos",
    "Silva", "Souza", "Teixeira", "Vieira",
]  # fmt: skip
MODELOS = [
    "Volvo FH 540", "Scania R 450", "Mercedes-Benz Actros 2651", "DAF XF 530",
    "Volkswagen Meteor 29.520", "Iveco S-Way 540",
]  # fmt: skip


def gerar_frota(semente: int = 7) -> list[Veiculo]:
    gerador = random.Random(semente)
    veiculos = []
    for numero, placa in enumerate(PLACAS_DA_FROTA):
        # Um em cada dez caminhões está parado no pátio, sem motorista escalado.
        motorista = None
        if numero == 0 or gerador.random() >= 0.1:
            motorista = Motorista(
                nome=f"{gerador.choice(NOMES)} {gerador.choice(SOBRENOMES)}",
                telefone=f"+55109{gerador.randint(0, 99_999_999):08d}",
            )
        veiculos.append(Veiculo(placa=placa, modelo=gerador.choice(MODELOS), motorista=motorista))
    return veiculos


def semear_frota(sessao: Session) -> int:
    """Cria a frota se ela ainda não existe (idempotente). Devolve quantos veículos criou."""
    if sessao.scalar(select(func.count()).select_from(Veiculo)):
        return 0
    veiculos = gerar_frota()
    sessao.add_all(veiculos)
    sessao.commit()
    return len(veiculos)


def posicionar_frota(sessao: Session, agora: datetime | None = None) -> None:
    """Põe cada caminhão onde a simulação diz que ele está agora: o mapa da frota não começa
    vazio, e a telemetria continua dali (scripts/simular_frota.py)."""
    agora = agora or datetime.now(UTC)
    ordem = {placa: n for n, placa in enumerate(PLACAS_DA_FROTA)}
    for veiculo in sessao.scalars(select(Veiculo)):
        if veiculo.placa not in ordem:
            continue
        estado = estado_do_caminhao(
            veiculo.placa, ordem[veiculo.placa], agora, veiculo.motorista_id is not None
        )
        veiculo.latitude = estado.local.lat
        veiculo.longitude = estado.local.lon
        veiculo.referencia = estado.local.referencia
        veiculo.velocidade_kmh = estado.velocidade_kmh
        veiculo.ignicao = estado.ignicao
        veiculo.ultima_leitura_em = agora
        veiculo.parado_desde = None
    sessao.commit()
