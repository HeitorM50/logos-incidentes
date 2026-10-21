# 0013 — Telemetria da frota e o mapa

**Status:** aceita · 20/10/2026

## Contexto

O simulador enviava incidentes prontos. Numa central de rastreamento real, o equipamento de bordo
manda **leituras** (posição, velocidade, sensores) e é a central que decide o que é incidente. A
demonstração também não mostrava onde os caminhões estavam.

## Decisão

- **`POST /telemetria`**: lote de até 200 leituras (placa, posição, velocidade, ignição, referência e
  sensores), autenticado pela chave de dispositivo da ingestão (ADR 0008). A central de
  rastreamento integra a frota inteira com uma credencial só, como no mercado.
- **Motor de regras** na API, uma regra por categoria: pânico → Acidente com Vítimas (Alta); impacto
  ≥ 4 g → Acidente com Veículo (Alta); motor ≥ 110 °C → Problema Mecânico (Média); visibilidade
  < 100 m → Condição Climática (Média); parado com ignição ligada há mais de 20 min → Bloqueio de
  Pista (Baixa). Não repete para o mesmo caminhão enquanto o incidente estiver ativo; cota de 20
  por hora. O incidente guarda a posição e o motorista do cadastro (ADR 0009).
- **Simulação sem estado**: 12 rodovias reais com coordenadas das cidades; a posição de cada
  caminhão sai da placa e do horário (vai e volta na rota, com paradas). O seed posiciona a frota
  e o workflow `demo-viva` roda 1 min de telemetria a cada 30 min.
- **Mapa esquemático em SVG próprio** (contorno do Brasil simplificado e projeção simples), sem
  biblioteca nem mapa externo: a CSP só permite recursos do próprio site. A lista ao lado é a
  versão acessível e o caminho até cada incidente. No mapa, "alerta" é só o incidente aberto pela
  telemetria (com posição); os registrados na central ficam na triagem.

## Alternativas consideradas

- **Leaflet/OpenStreetMap:** mapa real, mas tiles de servidor externo (CSP, dependência de rede)
  e uma biblioteca a mais para um painel de demonstração.
- **Processo contínuo no Render:** o plano gratuito não tem worker; o GitHub Actions já roda o
  agendamento.

## Consequências

- O sensor de "parado" depende de leituras seguidas: com 1 min a cada 30 min, só paradas longas
  (~45 min) viram alerta, o que é o comportamento desejado.
- Geocodificação reversa (coordenada → endereço) fica com a central de rastreamento, que já manda
  a referência; sem ela, o incidente mostra a coordenada.
- **Limitações conhecidas** (aceitas para o MVP, com um emissor só):
  - a posição do caminhão não confere a hora da leitura: um lote atrasado sobrescreve a posição
    mais nova e pode antecipar a regra de parada longa;
  - a regra não repete o alerta comparando placa e título do incidente ativo; se o analista
    edita o título, a próxima leitura pode abrir um incidente repetido;
  - "contar ativos → inserir" não é atômico: dois lotes simultâneos com o mesmo sinal podem
    abrir dois incidentes.
  A correção é uma coluna com a regra que abriu o incidente, um índice único parcial
  `(placa, regra)` nos ativos e ignorar leituras mais antigas que `ultima_leitura_em`.
