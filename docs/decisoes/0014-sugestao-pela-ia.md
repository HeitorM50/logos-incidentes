# 0014 — Novo incidente a partir da mensagem do motorista (IA)

**Status:** aceita · 20/10/2026

## Contexto

O enunciado descreve a dor: os incidentes chegam por WhatsApp e planilha, e o analista perde
tempo para transformar a mensagem em registro. Mesmo com a ingestão pelos caminhões (ADR 0008) e
a telemetria (ADR 0013), parte dos relatos continua chegando como texto livre do motorista.

## Decisão

- **`POST /sugestao`** (com login): recebe a mensagem colada (10 a 2.000 caracteres) e devolve os
  campos do formulário de novo incidente: título, categoria, criticidade, local, placa, nome do
  motorista e uma frase que justifica a criticidade. A mensagem original vira a descrição.
- **A IA só sugere.** Nada é gravado: o formulário é preenchido e o analista confere, corrige e
  salva pelo `POST /incidentes` de sempre, com as mesmas validações.
- **Claude pela API da Anthropic** (SDK oficial `anthropic`), com saída estruturada: a resposta é
  presa a um schema Pydantic com as categorias e criticidades fechadas do domínio. A API ainda
  ajusta a saída aos limites do formulário (título até 120 caracteres, placa só se for válida,
  campos vazios viram nulo).
- **A mensagem é dado de terceiros.** Ela vai delimitada, separada das instruções, e as
  instruções mandam ignorar pedidos escritos nela. Como a saída é presa ao schema e o analista
  confere tudo, uma mensagem maliciosa no máximo produz uma sugestão errada.
- **Modelo configurável** (`SUGESTAO_MODELO`, padrão `claude-opus-5-5`), com esforço baixo
  (extração simples, resposta mais rápida) e fallback automático no servidor da Anthropic se o
  modelo recusar o pedido.
- **Custo e abuso:** 5 pedidos por minuto por analista e um teto diário por instância
  (`SUGESTAO_LIMITE_DIARIO`, padrão 200), porque a conta de demonstração é pública.
- **Desligada sem chave.** Sem `ANTHROPIC_API_KEY`, `GET /sugestao` responde
  `{"disponivel": false}`, o bloco não aparece no formulário e o resto funciona igual. Erro,
  demora ou recusa da IA viram uma mensagem curta ("Preencha à mão"); o formulário nunca trava.

## Alternativas consideradas

- **Classificar sem LLM (palavras-chave):** previsível, mas erra fácil em texto informal ("bateu",
  "capotou", "tô parado") e não extrai local e placa.
- **Criar o incidente direto a partir da mensagem:** mais rápido, mas tira o analista da decisão
  justamente na criticidade, que define a ordem da fila.
- **Integração real com o WhatsApp Business:** exige conta verificada e número próprio; colar a
  mensagem resolve o mesmo problema no MVP.

## Consequências

- Cada sugestão custa uma chamada paga; o teto diário limita o gasto da demonstração.
- Os testes não chamam a Anthropic: trocam o extrator por um falso e, para o caminho real do SDK,
  trocam só o transporte HTTP, conferindo o pedido montado (schema, esforço, fallback).
