"""Telemetria da frota: posições e sinais dos caminhões viram incidentes por regra.

É o caminho de uma central de rastreamento real: o equipamento de bordo manda leituras (posição,
velocidade, sensores) e a central decide o que é incidente. Aqui, cada regra olha uma leitura (e
o estado guardado do veículo) e, se disparar, abre um incidente com a categoria e a criticidade
da regra. Uma regra não abre um segundo incidente para o mesmo caminhão enquanto o primeiro
estiver ativo, e uma cota por hora protege a triagem de uma enxurrada.
"""

from collections.abc import Callable
from dataclasses import dataclass
from datetime import UTC, datetime, timedelta

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.core.dominio import Categoria, Criticidade, StatusIncidente, TipoEvento
from app.models import Dispositivo, EventoIncidente, Incidente, Veiculo
from app.schemas.telemetria import IncidenteGerado, Leitura, LoteTelemetria, ResultadoTelemetria
from app.services.frota import completar_motorista

PARADO_ALERTA_MIN = 20
VELOCIDADE_PARADO_KMH = 3
COTA_POR_HORA = 20


@dataclass(frozen=True)
class Regra:
    codigo: str
    titulo: str
    categoria: Categoria
    criticidade: Criticidade
    disparou: Callable[[Leitura, Veiculo, datetime], bool]
    descrever: Callable[[Leitura, Veiculo], str]


def _parado_ha(veiculo: Veiculo, agora: datetime) -> float:
    if veiculo.parado_desde is None:
        return 0
    return (agora - veiculo.parado_desde).total_seconds() / 60


REGRAS: tuple[Regra, ...] = (
    Regra(
        "panico",
        "Botão de pânico acionado pelo motorista",
        Categoria.ACIDENTE_VITIMAS,
        Criticidade.ALTA,
        lambda leitura, _v, _a: leitura.sinais.panico,
        lambda leitura, _v: (
            f"Botão de pânico acionado a {leitura.velocidade_kmh} km/h. "
            "Ligar para o motorista e, sem resposta, acionar SAMU e PRF."
        ),
    ),
    Regra(
        "impacto",
        "Impacto forte detectado pelo sensor",
        Categoria.ACIDENTE_VEICULO,
        Criticidade.ALTA,
        lambda leitura, _v, _a: (leitura.sinais.impacto_g or 0) >= 4,
        lambda leitura, _v: (
            f"Sensor registrou impacto de {leitura.sinais.impacto_g:.1f} g "
            f"a {leitura.velocidade_kmh} km/h."
        ),
    ),
    Regra(
        "motor_quente",
        "Superaquecimento do motor detectado",
        Categoria.PROBLEMA_MECANICO,
        Criticidade.MEDIA,
        lambda leitura, _v, _a: (leitura.sinais.temperatura_motor_c or 0) >= 110,
        lambda leitura, _v: (
            f"Temperatura do motor em {leitura.sinais.temperatura_motor_c:.0f} °C (limite: 110 °C)."
        ),
    ),
    Regra(
        "visibilidade",
        "Visibilidade muito baixa na pista",
        Categoria.CONDICAO_CLIMATICA,
        Criticidade.MEDIA,
        lambda leitura, _v, _a: (
            leitura.sinais.visibilidade_m is not None and leitura.sinais.visibilidade_m < 100
        ),
        lambda leitura, _v: (
            f"Sensor de visibilidade marcou {leitura.sinais.visibilidade_m} m "
            "(neblina ou chuva forte)."
        ),
    ),
    Regra(
        "parado",
        "Caminhão parado há mais de 20 min na rodovia",
        Categoria.BLOQUEIO_PISTA,
        Criticidade.BAIXA,
        lambda _l, veiculo, agora: _parado_ha(veiculo, agora) >= PARADO_ALERTA_MIN,
        lambda _l, veiculo: (
            "Ignição ligada e velocidade zero desde "
            f"{veiculo.parado_desde:%H:%M} (UTC): fila, bloqueio ou pane."
        ),
    ),
)


def _atualizar_veiculo(veiculo: Veiculo, leitura: Leitura, quando: datetime) -> None:
    veiculo.latitude = leitura.latitude
    veiculo.longitude = leitura.longitude
    veiculo.velocidade_kmh = leitura.velocidade_kmh
    veiculo.ignicao = leitura.ignicao
    veiculo.referencia = leitura.referencia
    veiculo.ultima_leitura_em = quando
    parado = leitura.ignicao and leitura.velocidade_kmh <= VELOCIDADE_PARADO_KMH
    if not parado:
        veiculo.parado_desde = None
    elif veiculo.parado_desde is None:
        veiculo.parado_desde = quando


def _ja_ativo(sessao: Session, placa: str, titulo: str) -> bool:
    return bool(
        sessao.scalar(
            select(func.count())
            .select_from(Incidente)
            .where(
                Incidente.placa == placa,
                Incidente.titulo == titulo,
                Incidente.status != StatusIncidente.FECHADO,
            )
        )
    )


def _criados_na_ultima_hora(sessao: Session, dispositivo: Dispositivo, agora: datetime) -> int:
    return sessao.scalar(
        select(func.count())
        .select_from(Incidente)
        .where(
            Incidente.dispositivo_id == dispositivo.id,
            Incidente.criado_em >= agora - timedelta(hours=1),
        )
    )


def _abrir_incidente(
    sessao: Session, dispositivo: Dispositivo, leitura: Leitura, veiculo: Veiculo, regra: Regra
) -> Incidente:
    local = leitura.referencia or f"{leitura.latitude:.4f}, {leitura.longitude:.4f}"
    valores = completar_motorista(sessao, {"placa": leitura.placa})
    incidente = Incidente(
        titulo=regra.titulo,
        descricao=regra.descrever(leitura, veiculo),
        categoria=regra.categoria,
        criticidade=regra.criticidade,
        status=StatusIncidente.ABERTO,
        local=local[:160],
        latitude=leitura.latitude,
        longitude=leitura.longitude,
        versao=1,
        dispositivo_id=dispositivo.id,
        **valores,
    )
    sessao.add(incidente)
    sessao.flush()
    sessao.add(
        EventoIncidente(
            incidente_id=incidente.id, tipo=TipoEvento.CRIADO, status_novo=StatusIncidente.ABERTO
        )
    )
    return incidente


def receber(
    sessao: Session, dispositivo: Dispositivo, lote: LoteTelemetria, agora: datetime | None = None
) -> ResultadoTelemetria:
    agora = agora or datetime.now(UTC)
    placas = {leitura.placa for leitura in lote.leituras}
    veiculos = {
        v.placa: v for v in sessao.scalars(select(Veiculo).where(Veiculo.placa.in_(placas)))
    }
    cota = COTA_POR_HORA - _criados_na_ultima_hora(sessao, dispositivo, agora)
    gerados: list[IncidenteGerado] = []
    ignoradas = 0

    for leitura in lote.leituras:
        veiculo = veiculos.get(leitura.placa)
        if veiculo is None:
            ignoradas += 1
            continue
        # Leitura no futuro (relógio do equipamento adiantado) vale como "agora".
        quando = min(leitura.registrado_em or agora, agora)
        _atualizar_veiculo(veiculo, leitura, quando)
        for regra in REGRAS:
            if cota <= 0:
                break
            if not regra.disparou(leitura, veiculo, agora):
                continue
            if _ja_ativo(sessao, leitura.placa, regra.titulo):
                continue
            incidente = _abrir_incidente(sessao, dispositivo, leitura, veiculo, regra)
            gerados.append(
                IncidenteGerado(
                    id=incidente.id,
                    placa=leitura.placa,
                    regra=regra.codigo,
                    criticidade=regra.criticidade,
                )
            )
            cota -= 1

    sessao.commit()
    return ResultadoTelemetria(
        processadas=len(lote.leituras) - ignoradas, ignoradas=ignoradas, incidentes=gerados
    )
