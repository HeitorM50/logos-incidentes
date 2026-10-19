# 0002 — Concorrência: controle otimista com versão

**Status:** aceita · 18/10/2026

## Contexto

O case pergunta: "como sua aplicação garante que dois analistas não tentem resolver o mesmo problema
ao mesmo tempo?". Dois riscos existem:

1. **Atualização perdida:** dois analistas leem o incidente, os dois alteram, e a segunda gravação
   apaga a primeira sem ninguém perceber.
2. **Trabalho duplicado:** dois analistas começam a tratar o mesmo incidente.

## Decisão

**Controle de concorrência otimista + responsável pelo incidente.**

- Cada incidente tem a coluna `versao` (inteiro, começa em 1).
- Toda alteração (editar, mudar status, assumir, liberar, remover) envia a `versao` que o cliente leu.
- A API grava com uma única instrução atômica:

  ```sql
  UPDATE incidentes SET ..., versao = versao + 1
  WHERE id = :id AND versao = :versao_lida
  ```

- Se 0 linhas forem afetadas, alguém alterou antes: a API responde **409 Conflict** com o estado
  atual do incidente. O front avisa "outro analista alterou este incidente" e mostra a versão nova.
- **Assumir:** o analista assume o incidente (`responsavel`). Um incidente `aberto` assumido passa
  para `em_investigacao`. Se já houver outro responsável, a API responde 409 informando quem é.
- Com responsável definido, **só ele** muda o status. Ele pode liberar o incidente para outro analista.

## Alternativas consideradas

- **Lock pessimista (`SELECT ... FOR UPDATE`) durante a edição:** prende uma conexão do banco
  enquanto o analista decide; se a aba fechar, o lock fica preso até o timeout. Não escala.
- **Last write wins:** simples, mas causa exatamente a atualização perdida.
- **`atualizado_em` como versão:** depende da precisão do relógio; inteiro é determinístico.

## Consequências

- Nenhum lock é mantido entre requisições HTTP.
- O conflito é detectado no banco, numa instrução atômica, então funciona com várias instâncias da API.
- O cliente precisa sempre enviar a versão; a API rejeita alteração sem versão (422).
