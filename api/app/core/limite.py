import time
from collections import deque
from collections.abc import Callable
from threading import Lock

from slowapi import Limiter
from slowapi.util import get_remote_address
from starlette.requests import Request


def ip_do_cliente(request: Request) -> str:
    """IP usado no limite por IP do login.

    Em produção a API fica atrás da Cloudflare (Render), que grava o IP real do cliente em
    CF-Connecting-IP e sobrescreve o valor que o cliente mandar. O X-Forwarded-For não serve:
    o cliente escreve nele o que quiser, e um IP novo a cada tentativa furava o limite (visto
    na API publicada em 19/10/2026). Fora da Cloudflare (desenvolvimento, testes) vale o IP
    da conexão.
    """
    return request.headers.get("cf-connecting-ip") or get_remote_address(request)


limitador = Limiter(key_func=ip_do_cliente)


class LimiteFalhasLogin:
    """Bloqueia um usuário após muitas senhas erradas em pouco tempo.

    Complementa o limite por IP: o X-Forwarded-For pode ser forjado pelo cliente, mas o
    usuário atacado não muda. O estado fica em memória (uma instância da API no Render).
    Usuários sem falha recente saem da memória: sem isso, um nome inventado por tentativa
    faria o dicionário crescer para sempre.
    """

    # Acima deste número de usuários guardados, cada falha nova varre os vencidos.
    LIMITE_PARA_VARRER = 1000

    def __init__(
        self,
        maximo_falhas: int = 5,
        janela_segundos: float = 60,
        relogio: Callable[[], float] = time.monotonic,
    ):
        self.maximo_falhas = maximo_falhas
        self.janela_segundos = janela_segundos
        self._relogio = relogio
        self._falhas: dict[str, deque[float]] = {}
        self._trava = Lock()

    def _recentes(self, usuario: str) -> int:
        """Descarta as falhas fora da janela e devolve quantas sobraram."""
        falhas = self._falhas.get(usuario)
        if falhas is None:
            return 0
        limite = self._relogio() - self.janela_segundos
        while falhas and falhas[0] <= limite:
            falhas.popleft()
        if not falhas:
            del self._falhas[usuario]
        return len(falhas)

    def bloqueado(self, usuario: str) -> bool:
        with self._trava:
            return self._recentes(usuario) >= self.maximo_falhas

    def registrar_falha(self, usuario: str) -> None:
        with self._trava:
            if len(self._falhas) > self.LIMITE_PARA_VARRER:
                for nome in list(self._falhas):
                    self._recentes(nome)
            self._falhas.setdefault(usuario, deque()).append(self._relogio())

    def usuarios_guardados(self) -> int:
        with self._trava:
            return len(self._falhas)

    def limpar(self, usuario: str) -> None:
        with self._trava:
            self._falhas.pop(usuario, None)

    def reiniciar(self) -> None:
        with self._trava:
            self._falhas.clear()


falhas_login = LimiteFalhasLogin()
