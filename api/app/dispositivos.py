"""Gestão dos dispositivos (caminhões) que enviam incidentes pela ingestão.

    uv run python -m app.dispositivos criar "Caminhão 042" --placa ABC1D23
    uv run python -m app.dispositivos listar
    uv run python -m app.dispositivos desativar 3

A chave aparece uma vez só, na criação: o banco guarda apenas o hash dela.
"""

import argparse
import secrets

from sqlalchemy import select

from app.core.banco import obter_fabrica_sessoes
from app.core.dispositivo import hash_da_chave
from app.models import Dispositivo
from app.schemas.incidente import normalizar_placa


def main() -> None:
    parser = argparse.ArgumentParser(description="Dispositivos da ingestão do Logos")
    comandos = parser.add_subparsers(dest="comando", required=True)
    criar = comandos.add_parser("criar", help="cria um dispositivo e mostra a chave uma vez")
    criar.add_argument("nome")
    criar.add_argument("--placa")
    comandos.add_parser("listar", help="lista os dispositivos")
    desativar = comandos.add_parser("desativar", help="corta o acesso de um dispositivo")
    desativar.add_argument("id", type=int)
    argumentos = parser.parse_args()

    with obter_fabrica_sessoes()() as sessao:
        if argumentos.comando == "criar":
            nome = argumentos.nome.strip()
            if not 1 <= len(nome) <= 80:
                parser.error("o nome precisa ter de 1 a 80 caracteres")
            try:
                placa = normalizar_placa(argumentos.placa)
            except ValueError as erro:
                parser.error(str(erro))
            chave = secrets.token_urlsafe(32)
            dispositivo = Dispositivo(
                nome=nome,
                placa=placa,
                chave_hash=hash_da_chave(chave),
                ativo=True,
            )
            sessao.add(dispositivo)
            sessao.commit()
            print(f"Dispositivo {dispositivo.id} criado: {dispositivo.nome}")
            print(f"Chave (guarde agora; ela não aparece de novo): {chave}")
        elif argumentos.comando == "listar":
            for d in sessao.scalars(select(Dispositivo).order_by(Dispositivo.id)):
                situacao = "ativo" if d.ativo else "desativado"
                print(f"{d.id:>4}  {situacao:<11} {d.placa or '-':<8} {d.nome}")
        else:
            dispositivo = sessao.get(Dispositivo, argumentos.id)
            if dispositivo is None:
                raise SystemExit(f"Dispositivo {argumentos.id} não existe.")
            dispositivo.ativo = False
            sessao.commit()
            print(f"Dispositivo {dispositivo.id} desativado.")


if __name__ == "__main__":
    main()
