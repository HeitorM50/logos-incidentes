# 0009 — Contato do motorista: cadastro da frota e cópia no incidente

**Status:** aceita · 20/10/2026

## Contexto

Para resolver um incidente, o analista precisa falar com o motorista: confirmar o que aconteceu,
saber se há feridos, orientar. O contato pertence ao **motorista**, não à placa: o motorista de um
caminhão muda a cada viagem ou turno. E o telefone é dado pessoal.

## Decisão

- **Cadastro (fonte):** tabelas `veiculos` (placa única, modelo) e `motoristas` (nome, telefone);
  cada veículo aponta para o motorista atual (migração 0005).
- **Cópia no incidente (histórico):** `motorista_nome` e `motorista_telefone` no incidente. Ao
  criar com placa cadastrada e sem contato informado, a API copia o motorista atual do veículo;
  a ingestão faz o mesmo. O analista pode corrigir ou apagar.
- Telefone normalizado para `+55DDDNÚMERO`; número estrangeiro é recusado. Os detalhes mostram
  "Ligar" (`tel:`) e "WhatsApp" (`wa.me`), o canal que a central já usa.
- `GET /veiculos/{placa}` só com login; a API não grava o corpo das requisições em log.
- Demonstração: nomes inventados e telefones no DDD 10, que não existe.

## Alternativas consideradas

- **Só um campo no incidente:** simples, mas o analista digitaria o telefone toda vez, e o
  rastreador não sabe quem está dirigindo.
- **O incidente apontar para o motorista:** o histórico mudaria sozinho quando o veículo trocasse
  de motorista; o incidente precisa guardar quem dirigia naquele momento.

## Consequências

- Incidentes criados antes do cadastro ficam sem contato até serem recriados ou editados.
- A tela de manutenção do cadastro (trocar o motorista de um veículo) fica para depois; hoje o
  cadastro vem do seed.
