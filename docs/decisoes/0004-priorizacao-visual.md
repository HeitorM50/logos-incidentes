# 0004 — Priorização visual dos 100 incidentes

**Status:** aceita · 18/10/2026

## Contexto

O case repete duas vezes: o analista precisa olhar 100 incidentes e identificar a prioridade
"em milissegundos". É gestão por exceção: o que importa precisa saltar aos olhos; o resto, recuar.

## Decisão

- **Ordenação padrão:** criticidade (alta → baixa) e, dentro dela, o incidente aberto há mais tempo
  primeiro. Incidentes fechados vão para o fim.
- **Codificação redundante da criticidade:** cor **e** ícone/forma **e** peso da fonte. Cor sozinha
  falha para cerca de 8% dos homens (daltonismo).
- **Uma linha por incidente,** colunas fixas e escaneáveis: criticidade, título, categoria, local,
  tempo aberto, status, responsável.
- **Tempo aberto relativo** ("há 12 min"), que é o que o analista compara.
- **Contadores por criticidade no topo,** que também funcionam como filtro.
- **Filtros na URL:** o analista compartilha ou recarrega a visão sem perder o contexto.

## Alternativas consideradas

- **Cards em grade:** bonitos, mas mostram poucos incidentes por tela e quebram a leitura em coluna.
- **Mapa:** útil no futuro, mas não responde "qual é o mais urgente" e exige geolocalização real.

## Consequências

- A API devolve a lista já ordenada (o tipo `ENUM` do Postgres ordena alta → média → baixa).
- O contraste de cada combinação é verificado nos dois temas (meta: WCAG AA).
