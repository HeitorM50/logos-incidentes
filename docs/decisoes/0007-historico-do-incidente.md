# 0007 — Histórico do incidente

**Status:** aceita · 19/10/2026

## Contexto

O protótipo mostra, em cada incidente, uma linha do tempo: quem registrou, quem assumiu, quem
mudou o status. Numa central com vários analistas, é o que responde "o que já foi feito aqui?"
sem perguntar a ninguém. O incidente guardava só o último autor (`atualizado_por`).

## Decisão

- Tabela `eventos_incidente`, com uma linha por alteração: tipo, autor, status anterior e novo,
  e os campos editados.
- O evento é gravado **na mesma transação** do `UPDATE ... WHERE versao = :v` (ADR 0002). Se o
  UPDATE não acha a versão (409) ou qualquer passo falha, a transação desfaz tudo: nunca há
  evento de uma alteração que não aconteceu, nem alteração sem evento.
- A edição registra só os campos cujo valor mudou de fato. Uma edição sem mudança real não sobe
  a versão nem grava evento (não gera 409 falso para os outros analistas).
- `GET /incidentes/{id}/eventos` devolve a linha do tempo. O front lê o histórico só quando o
  analista abre os detalhes, com a versão do incidente na chave do cache: quando a leitura de 5 s
  traz uma versão nova, o histórico é relido sozinho.
- A migration dá histórico aos incidentes que já existiam, derivado do estado atual (a mesma
  regra do seed): registrado → assumido, se há responsável → mudança para Inconclusivo ou
  Fechado, quando for o caso. Nenhum incidente "Fechado" aparece só como "registrado".

## Alternativas consideradas

- **Trigger no Postgres:** grava sempre, mas não sabe qual analista fez a ação (a API conecta
  com um único usuário de banco) e espalha regra de negócio entre a API e o banco.
- **Coluna JSON com o histórico dentro do incidente:** cada alteração reescreveria a lista
  inteira e disputaria a mesma linha que o controle de versão protege.
- **Log de aplicação:** não é consultável pela interface e não sobrevive à hibernação do Render.

## Consequências

- Uma linha a mais por alteração; com o índice por incidente e data, a leitura continua barata.
- A rota devolve o histórico inteiro, sem paginação: um incidente acumula poucos eventos (um
  por ação do analista). Se isso mudar, a rota ganha `limit`/cursor pelo mesmo índice.
- Remover o incidente remove o histórico (`ON DELETE CASCADE`), coerente com a remoção ser
  permitida só para o que ainda está em andamento.
