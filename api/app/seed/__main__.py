"""Popula o banco com dados de demonstração: `uv run python -m app.seed`."""

from app.core.banco import obter_fabrica_sessoes
from app.seed.analistas import semear_analistas


def main() -> None:
    with obter_fabrica_sessoes()() as sessao:
        analistas = semear_analistas(sessao)
    print(f"Analistas: {', '.join(a.usuario for a in analistas)}")


if __name__ == "__main__":
    main()
