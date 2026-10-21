# 0011 — Papel de supervisor e transferência

**Status:** aceita · 20/10/2026

## Contexto

Na troca de turno, ou com um analista sobrecarregado, alguém precisa redistribuir a fila. Pela
regra de concorrência (ADR 0002), só o responsável mexe no incidente que assumiu.

## Decisão

- O analista ganha um papel: `analista` ou `supervisor` (migração 0006).
- Só o supervisor transfere: `POST /incidentes/{id}/transferir`, com a versão lida (409 como
  qualquer alteração) e comentário opcional. Um Aberto vai para Em Investigação, como ao assumir.
- O papel é lido do banco a cada requisição, não do token: rebaixar um supervisor vale na hora,
  sem esperar o token expirar.
- O histórico registra o evento `transferido` com o autor e o novo responsável. No front, a
  transferência é mais uma ação (otimista, 409, "Desfazer").
- O botão "Transferir" só aparece para o supervisor; para os outros, a API responde 403.

## Alternativas consideradas

- **Qualquer analista "tomar" o incidente de outro:** quebra a garantia de que dois analistas não
  tratam o mesmo problema.
- **Papel no token (JWT):** mais rápido, mas um rebaixamento só valeria no próximo login.

## Consequências

- Tela de gestão de usuários e papéis fica fora do MVP; o supervisor de demonstração vem do seed.
