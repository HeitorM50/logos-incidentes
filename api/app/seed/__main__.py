"""Popula o banco com dados de demonstração.

uv run python -m app.seed             # cria o que falta (pode rodar várias vezes)
uv run python -m app.seed --recriar   # apaga os incidentes e recria os 100 (antes da demo)
"""

import argparse

from app.core.banco import obter_fabrica_sessoes
from app.seed.analistas import semear_analistas
from app.seed.dispositivos import semear_dispositivo_demo
from app.seed.frota import semear_frota
from app.seed.incidentes import semear_incidentes


def main() -> None:
    parser = argparse.ArgumentParser(description="Dados de demonstração do Logos")
    parser.add_argument("--recriar", action="store_true", help="apaga e recria os incidentes")
    argumentos = parser.parse_args()

    with obter_fabrica_sessoes()() as sessao:
        analistas = semear_analistas(sessao)
        # Antes dos incidentes: eles copiam o contato do motorista de cada placa.
        veiculos = semear_frota(sessao)
        criados = semear_incidentes(sessao, analistas, recriar=argumentos.recriar)
        dispositivo = semear_dispositivo_demo(sessao)
    print(f"Analistas: {', '.join(a.usuario for a in analistas)}")
    print(f"Veículos criados: {veiculos}")
    print(f"Incidentes criados: {criados}")
    print(f"Dispositivo de demonstração: {dispositivo.nome}")


if __name__ == "__main__":
    main()
