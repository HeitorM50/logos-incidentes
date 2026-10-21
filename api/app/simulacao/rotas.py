"""Rodovias da frota de demonstração, com coordenadas reais aproximadas das cidades no caminho.

Servem ao simulador (onde cada caminhão está) e ao mapa da tela "Frota" (o desenho das
estradas). A distância é a de linha reta entre os pontos (haversine): basta para estimar o km
e a referência ("BR-116, km 412 — Registro/SP") de uma leitura.
"""

import math
from dataclasses import dataclass


@dataclass(frozen=True)
class Ponto:
    lat: float
    lon: float
    cidade: str


@dataclass(frozen=True)
class Rota:
    rodovia: str
    km_inicial: int
    pontos: tuple[Ponto, ...]


P = Ponto
ROTAS: tuple[Rota, ...] = (
    Rota(
        "Rod. Presidente Dutra",
        0,
        (
            P(-22.90, -43.20, "Rio de Janeiro/RJ"),
            P(-22.75, -43.68, "Seropédica/RJ"),
            P(-22.47, -44.45, "Resende/RJ"),
            P(-22.58, -45.00, "Cachoeira Paulista/SP"),
            P(-23.18, -45.88, "São José dos Campos/SP"),
            P(-23.39, -46.32, "Arujá/SP"),
            P(-23.55, -46.63, "São Paulo/SP"),
        ),
    ),
    Rota(
        "Rod. Régis Bittencourt",
        270,
        (
            P(-23.55, -46.63, "São Paulo/SP"),
            P(-23.72, -46.85, "Embu das Artes/SP"),
            P(-24.17, -47.55, "Miracatu/SP"),
            P(-24.49, -47.84, "Registro/SP"),
            P(-24.73, -48.12, "Cajati/SP"),
            P(-25.43, -49.27, "Curitiba/PR"),
        ),
    ),
    Rota(
        "Rod. Fernão Dias",
        0,
        (
            P(-23.55, -46.63, "São Paulo/SP"),
            P(-23.03, -46.55, "Atibaia/SP"),
            P(-22.23, -45.94, "Pouso Alegre/MG"),
            P(-21.77, -45.25, "Três Corações/MG"),
            P(-20.70, -44.60, "Oliveira/MG"),
            P(-19.97, -44.20, "Betim/MG"),
            P(-19.92, -43.94, "Belo Horizonte/MG"),
        ),
    ),
    Rota(
        "BR-040",
        520,
        (
            P(-19.92, -43.94, "Belo Horizonte/MG"),
            P(-20.40, -43.80, "Conselheiro Lafaiete/MG"),
            P(-21.76, -43.35, "Juiz de Fora/MG"),
            P(-22.50, -43.18, "Petrópolis/RJ"),
            P(-22.79, -43.31, "Duque de Caxias/RJ"),
        ),
    ),
    Rota(
        "BR-101",
        0,
        (
            P(-26.30, -48.85, "Joinville/SC"),
            P(-26.91, -48.66, "Itajaí/SC"),
            P(-27.59, -48.55, "Florianópolis/SC"),
            P(-28.48, -48.78, "Laguna/SC"),
            P(-28.68, -49.37, "Criciúma/SC"),
        ),
    ),
    Rota(
        "BR-277",
        0,
        (
            P(-25.43, -49.27, "Curitiba/PR"),
            P(-25.09, -50.16, "Ponta Grossa/PR"),
            P(-25.39, -51.46, "Guarapuava/PR"),
            P(-24.96, -53.46, "Cascavel/PR"),
            P(-25.52, -54.58, "Foz do Iguaçu/PR"),
        ),
    ),
    Rota(
        "BR-153",
        0,
        (
            P(-16.33, -48.95, "Anápolis/GO"),
            P(-16.68, -49.25, "Goiânia/GO"),
            P(-17.75, -49.10, "Morrinhos/GO"),
            P(-18.42, -49.21, "Itumbiara/GO"),
            P(-20.82, -49.38, "São José do Rio Preto/SP"),
        ),
    ),
    Rota(
        "BR-060",
        0,
        (
            P(-15.79, -47.88, "Brasília/DF"),
            P(-16.07, -48.28, "Alexânia/GO"),
            P(-16.33, -48.95, "Anápolis/GO"),
            P(-16.68, -49.25, "Goiânia/GO"),
        ),
    ),
    Rota(
        "BR-050",
        0,
        (
            P(-16.68, -49.25, "Goiânia/GO"),
            P(-17.73, -48.62, "Pires do Rio/GO"),
            P(-18.17, -47.94, "Catalão/GO"),
            P(-18.92, -48.28, "Uberlândia/MG"),
            P(-19.75, -47.93, "Uberaba/MG"),
        ),
    ),
    Rota(
        "BR-163",
        0,
        (
            P(-15.60, -56.10, "Cuiabá/MT"),
            P(-14.62, -56.10, "Rosário Oeste/MT"),
            P(-13.55, -56.00, "Nova Mutum/MT"),
            P(-12.55, -55.71, "Sorriso/MT"),
            P(-11.86, -55.50, "Sinop/MT"),
        ),
    ),
    Rota(
        "BR-364",
        0,
        (
            P(-15.60, -56.10, "Cuiabá/MT"),
            P(-15.88, -55.33, "Jaciara/MT"),
            P(-16.47, -54.64, "Rondonópolis/MT"),
        ),
    ),
    Rota(
        "Rod. Anhanguera (SP-330)",
        0,
        (
            P(-23.55, -46.63, "São Paulo/SP"),
            P(-23.19, -46.88, "Jundiaí/SP"),
            P(-22.91, -47.06, "Campinas/SP"),
            P(-22.56, -47.40, "Limeira/SP"),
            P(-21.18, -47.81, "Ribeirão Preto/SP"),
        ),
    ),
)

RAIO_TERRA_KM = 6371.0


def distancia_km(a: Ponto, b: Ponto) -> float:
    la1, la2 = math.radians(a.lat), math.radians(b.lat)
    d_lat, d_lon = la2 - la1, math.radians(b.lon - a.lon)
    h = math.sin(d_lat / 2) ** 2 + math.cos(la1) * math.cos(la2) * math.sin(d_lon / 2) ** 2
    return 2 * RAIO_TERRA_KM * math.asin(math.sqrt(h))


def comprimento_km(rota: Rota) -> float:
    return sum(distancia_km(a, b) for a, b in zip(rota.pontos, rota.pontos[1:], strict=False))


@dataclass(frozen=True)
class Local:
    lat: float
    lon: float
    referencia: str


def ponto_na_rota(rota: Rota, km_percorridos: float) -> Local:
    """Posição a `km_percorridos` do início da rota, e a referência pela cidade mais próxima."""
    restante = max(0.0, km_percorridos)
    for a, b in zip(rota.pontos, rota.pontos[1:], strict=False):
        trecho = distancia_km(a, b)
        if restante <= trecho or b is rota.pontos[-1]:
            fracao = min(1.0, restante / trecho) if trecho else 0.0
            lat = a.lat + (b.lat - a.lat) * fracao
            lon = a.lon + (b.lon - a.lon) * fracao
            cidade = a.cidade if fracao < 0.5 else b.cidade
            km = rota.km_inicial + round(min(km_percorridos, comprimento_km(rota)))
            return Local(round(lat, 5), round(lon, 5), f"{rota.rodovia}, km {km} — {cidade}")
        restante -= trecho
    ultimo = rota.pontos[-1]
    return Local(ultimo.lat, ultimo.lon, f"{rota.rodovia} — {ultimo.cidade}")
