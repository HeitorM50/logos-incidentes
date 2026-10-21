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
- **Gemini pela API do Google** (SDK oficial `google-genai`, modelo `gemini-flash-latest`), com
  saída estruturada: a resposta é presa a um schema Pydantic com as categorias e criticidades
  fechadas do domínio. O **Claude** (SDK oficial `anthropic`) continua como alternativa: a API usa
  o Gemini se houver `GEMINI_API_KEY`, senão o Claude com `ANTHROPIC_API_KEY`. O schema e as
  instruções são os mesmos para os dois. A API ainda
  ajusta a saída aos limites do formulário (título até 120 caracteres, placa só se for válida,
  campos vazios viram nulo).
- **A mensagem é dado de terceiros.** Ela vai delimitada, separada das instruções, e as
  instruções mandam ignorar pedidos escritos nela. Como a saída é presa ao schema e o analista
  confere tudo, uma mensagem maliciosa no máximo produz uma sugestão errada.
- **Modelo configurável** (`SUGESTAO_MODELO`). No Gemini, temperatura 0 (a mesma mensagem dá a
  mesma sugestão); no Claude, esforço baixo e fallback automático no servidor da Anthropic se o
  modelo recusar o pedido.
- **Custo e abuso:** 5 pedidos por minuto por analista e um teto diário por instância
  (`SUGESTAO_LIMITE_DIARIO`, padrão 200), porque a conta de demonstração é pública.
- **Desligada sem chave.** Sem nenhuma das duas chaves, `GET /sugestao` responde
  `{"disponivel": false}`, o bloco não aparece no formulário e o resto funciona igual. Erro,
  demora ou recusa da IA viram uma mensagem curta ("Preencha à mão"); o formulário nunca trava.

## Alternativas consideradas

- **Só o Claude:** foi a primeira implementação; a demonstração passou a usar o plano gratuito do
  Gemini para não depender de crédito pago. O código do Claude ficou, porque o contrato é o mesmo.
- **Regras em Python (sem LLM):** sem chave e sem custo, mas descartado pelos motivos abaixo.

- **Classificar sem LLM (palavras-chave):** previsível, mas erra fácil em texto informal ("bateu",
  "capotou", "tô parado") e não extrai local e placa.
- **Criar o incidente direto a partir da mensagem:** mais rápido, mas tira o analista da decisão
  justamente na criticidade, que define a ordem da fila.
- **Integração real com o WhatsApp Business:** exige conta verificada e número próprio; colar a
  mensagem resolve o mesmo problema no MVP.

## Consequências

- No plano gratuito do Gemini, o Google pode usar as mensagens enviadas para melhorar os produtos
  dele. Na demonstração os dados são fictícios; em produção real, o certo é o plano pago (ou o
  Claude), que não usa os dados assim, porque a mensagem traz nome e placa do motorista.
- O plano gratuito tem limite de pedidos por minuto e por dia; o teto diário da API fica abaixo
  dele, e o excesso vira a mensagem "Preencha à mão".
- Os testes não chamam o Google nem a Anthropic: trocam o extrator por um falso e, para o caminho
  real de cada SDK, trocam só o transporte HTTP, conferindo o pedido montado (schema, chave no
  cabeçalho, temperatura, esforço, fallback).
