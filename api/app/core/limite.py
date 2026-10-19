from slowapi import Limiter
from slowapi.util import get_remote_address

# Em produção a API roda atrás do proxy do Render; o uvicorn sobe com --proxy-headers para
# que o IP real do cliente (X-Forwarded-For) seja usado como chave.
limitador = Limiter(key_func=get_remote_address)
