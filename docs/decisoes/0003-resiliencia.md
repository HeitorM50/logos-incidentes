# 0003 — Resiliência a banco lento e falha de rede

**Status:** aceita · 18/10/2026

## Contexto

O case pergunta: "como seu código trata o estado da aplicação enquanto o banco processa uma
atualização?" e pede que o sistema não "quebre" se a conexão oscilar.

## Decisão

**No front (estado da tela):**

- **Atualização otimista:** a alteração aparece na tela imediatamente, marcada como pendente.
- **Rollback:** se a API falhar, o front restaura o estado anterior e mostra um aviso.
- **Sem clique duplo:** a ação fica bloqueada enquanto a requisição está pendente.
- **Estados explícitos:** carregando, erro, vazio, reconectando e "acordando servidor". O usuário
  nunca fica sem saber se o sistema travou.
- **Retry automático** de leituras com backoff (TanStack Query). Escritas não são repetidas
  automaticamente, para não duplicar ações.

**Na API:**

- **Timeout de consulta** (`statement_timeout`) — uma consulta lenta não prende a requisição.
- **Retry com backoff** só em erro transitório de conexão, e só antes de qualquer gravação.
- Falha persistente → **503 Service Unavailable** com `Retry-After`, nunca stack trace.
- `pool_pre_ping` descarta conexões mortas do pool antes de usá-las.

**Demonstração:** `SIMULAR_LATENCIA_MS` atrasa todas as rotas de incidentes (mostra os estados de
carregamento) e `SIMULAR_FALHA_PCT` faz uma fração das escritas falhar com 503 antes de gravar (mostra
o rollback ao vivo). As duas ficam desligadas por padrão.

## Alternativas consideradas

- **Atualização pessimista** (esperar a resposta para atualizar a tela): mais simples, mas a tela
  parece travada com banco lento — o oposto do que o case pede.
- **Fila de escrita offline:** robusta, mas complexa demais para o prazo e arriscada com conflitos.

## Consequências

- O estado de servidor fica todo no TanStack Query; componentes não chamam `fetch` diretamente.
- O 409 da ADR 0002 e o rollback daqui usam o mesmo caminho de tratamento de erro no front.
