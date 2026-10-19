import time
from collections import defaultdict, deque
from collections.abc import Callable
from threading import Lock

from slowapi import Limiter
from slowapi.util import get_remote_address

# Limite por IP. Em produção a API roda atrás do proxy do Render; o uvicorn sobe com
# --proxy-headers para usar o IP do cliente (X-Forwarded-For).
limitador = Limiter(key_func=get_remote_address)


class LimiteFalhasLogin:
    """Bloqueia um usuário após muitas senhas erradas em pouco tempo.

    Complementa o limite por IP: o X-Forwarded-For pode ser forjado pelo cliente, mas o
    usuário atacado não muda. O estado fica em memória (uma instância da API no Render).
    """

    def __init__(
        self,
        maximo_falhas: int = 5,
        janela_segundos: float = 60,
        relogio: Callable[[], float] = time.monotonic,
    ):
        self.maximo_falhas = maximo_falhas
        self.janela_segundos = janela_segundos
        self._relogio = relogio
        self._falhas: dict[str, deque[float]] = defaultdict(deque)
        self._trava = Lock()

    def _descartar_antigas(self, usuario: str) -> deque[float]:
        limite = self._relogio() - self.janela_segundos
        falhas = self._falhas[usuario]
        while falhas and falhas[0] <= limite:
            falhas.popleft()
        return falhas

    def bloqueado(self, usuario: str) -> bool:
        with self._trava:
            return len(self._descartar_antigas(usuario)) >= self.maximo_falhas

    def registrar_falha(self, usuario: str) -> None:
        with self._trava:
            self._descartar_antigas(usuario).append(self._relogio())

    def limpar(self, usuario: str) -> None:
        with self._trava:
            self._falhas.pop(usuario, None)

    def reiniciar(self) -> None:
        with self._trava:
            self._falhas.clear()


falhas_login = LimiteFalhasLogin()
