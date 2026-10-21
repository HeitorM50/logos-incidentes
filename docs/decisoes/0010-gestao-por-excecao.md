# 0010 — Gestão por exceção: situação, prazo para assumir e possível duplicata

**Status:** aceita · 20/10/2026

## Contexto

Com 100 incidentes na tela, o analista precisa ver o que exige ação e o que está sendo
esquecido. Três problemas apareceram no uso: os fechados misturados com os ativos; nada indicava
um Alta sem ninguém há meia hora; e dois relatos do mesmo problema viravam dois atendimentos.

## Decisão

- **Situação:** a triagem mostra só os ativos; o seletor Ativos / Fechados / Todos traz o resto,
  com o fechado mais recente primeiro. Fica na URL.
- **Prazo para assumir** por criticidade (Alta 15 min, Média 60, Baixa 240), regra da API publicada
  em `/regras`. Ativo sem responsável além do prazo ganha o marcador "Atrasado" (texto e ícone) e
  entra no filtro "Atrasados". O cálculo é no front, com o relógio da tela.
- **Possível duplicata:** a API marca o incidente ativo que, até 2 h depois de outro ativo, tem a
  mesma placa, ou o mesmo local e a mesma categoria. Só aponta ("Dup. #N" e o caminho até o
  original); quem decide é o analista. Nada é fundido sozinho.

## Alternativas consideradas

- **Fundir duplicatas automaticamente:** um falso positivo apagaria um incidente real. O custo
  de um analista conferir é menor que o de perder um acidente.
- **Prazo calculado na API:** exigiria nova leitura para um incidente "virar" atrasado; no front,
  ele vira atrasado no minuto certo, sem chamada.

## Consequências

- O seed precisou ser realista (abertos quase todos no prazo, km sorteado, duas duplicatas
  plantadas): com dados ingênuos, quase tudo aparecia atrasado ou duplicado.
