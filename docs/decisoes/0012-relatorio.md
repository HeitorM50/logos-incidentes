# 0012 — Relatório, PDF e demonstração viva

**Status:** aceita · 20/10/2026

## Contexto

O protótipo de 20/10 trouxe um "Incident Report" (funil, números animados, métricas). A central
também precisa de um registro do período para fora da tela, e a demonstração não pode parecer
parada para quem a abrir dias depois.

## Decisão

- **Painel "Relatório"** ao lado de "Novo incidente", e não um bloco na triagem: a lista continua no
  topo. Dados de `GET /relatorio` (funil, tempos médios, taxa de atraso, recebidos por hora),
  calculados do histórico e comparados com o período anterior do mesmo tamanho.
- **Bibliotecas** (escolha do Heitor, para seguir o protótipo): reaviz (funil e área),
  react-countup e framer-motion. Ficam num pedaço separado do build, carregado só quando o
  painel abre (`React.lazy`); as animações respeitam `prefers-reduced-motion`.
- **Mini gráficos fora dos cartões de criticidade:** no cartão, o número é o que o analista lê;
  a série de recebidos por hora fica no relatório.
- **PDF pela impressão do navegador:** "Exportar PDF" monta um documento próprio para A4 e abre a
  impressão ("Salvar como PDF"). Sem biblioteca de PDF: fonte, acentos e layout são os do app.
  O registro (`GET /relatorio/registro`) traz os incidentes recebidos ou fechados no período e a
  linha do tempo.
- **Demonstração viva:** o workflow `demo-viva.yml` recria os dados às 06:00 e, a cada 30 min,
  faz um caminhão da frota enviar um incidente pela ingestão.

## Alternativas consideradas

- **Gráficos em SVG próprio:** zero dependência, mas menos fiel ao protótipo escolhido.
- **PDF gerado na API ou com jsPDF:** download direto, mas biblioteca nova, fonte embutida e
  problemas com caracteres fora do Latin-1 ("—", "→").

## Consequências

- O PDF pede um passo a mais (o diálogo de impressão).
- A recriação diária apaga o que o avaliador mudou no dia anterior, de propósito.
