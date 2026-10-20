# 0008 — Ingestão pelos caminhões

**Status:** aceita · 20/10/2026

## Contexto

O case pede "uma API robusta que **receba** e sirva incidentes". Até aqui, só analistas criavam
incidentes, com login e JWT. Na operação real, quem detecta o pneu estourado ou o tombamento é o
rastreador do caminhão, e a rede na estrada oscila: o mesmo envio pode chegar duas vezes.

## Decisão

- Rota própria, `POST /ingestao/incidentes`, separada da rota dos analistas.
- **Autenticação por dispositivo:** cada caminhão tem uma chave longa e aleatória, enviada em
  `X-Chave-Dispositivo`. O banco guarda só o **hash SHA-256** (tabela `dispositivos`); a chave
  aparece uma vez, na criação (`python -m app.dispositivos criar`). Desativar corta o acesso sem
  apagar o que o dispositivo já enviou. O JWT de analista não serve nesta rota, e a chave do
  dispositivo não serve nas rotas dos analistas.
- **Idempotência:** o cabeçalho `Idempotency-Key` é obrigatório. O par (dispositivo, chave) é
  `UNIQUE` na tabela `ingestoes`: o primeiro envio responde **201**; um reenvio com a mesma
  chave responde **200** com o mesmo incidente e `Idempotent-Replayed: true`. Dois reenvios ao
  mesmo tempo também geram um incidente só: quem decide é a restrição do banco, e o perdedor
  desfaz tudo (incidente, evento e registro) e devolve o do vencedor. Só essa restrição é
  tratada como reenvio; qualquer outra violação de integridade continua sendo erro.
- **Mesma chave, outro conteúdo:** o registro guarda o hash do corpo. Um reenvio com a mesma
  chave e corpo diferente responde **422** (`chave_reutilizada`): é defeito do rastreador, e
  devolver o incidente antigo com 200 faria a ocorrência nova sumir em silêncio.
- O incidente guarda a origem (`dispositivo_id`); o histórico registra o recebimento sem autor, e
  a tela mostra "Recebido de …" e a origem nos detalhes.
- Sem placa no corpo, vale a placa cadastrada do caminhão.
- **Limites:** 60 envios por minuto por IP, contados **antes** da autenticação (chave errada e
  corpo inválido também contam), e uma **cota de 30 incidentes por hora por dispositivo**,
  contada no banco. Reenvios já recebidos não gastam cota.
- **CORS:** os cabeçalhos `X-Chave-Dispositivo` e `Idempotency-Key` não são liberados para o
  navegador, de propósito: a rota é para rastreadores, não para páginas web.

## Alternativas consideradas

- **Reaproveitar o JWT de analista:** mistura pessoa e máquina, e um token de 8 h num
  rastreador sem tela para renovar.
- **mTLS ou assinatura HMAC por requisição:** mais forte, mas pede gestão de certificados ou
  relógio sincronizado nos dispositivos; demais para o MVP.
- **Deduplicar por conteúdo (mesmo título e local em X minutos):** confunde dois incidentes
  parecidos e reais com um reenvio. A chave de idempotência é explícita.

## Consequências

- Um dispositivo de demonstração é criado pelo seed, com chave pública (como o login de
  demonstração), e `scripts/simular_caminhao.py` mostra o fluxo: envia, reenvia e não duplica.
  **Risco aceito:** com a chave pública, qualquer pessoa cria incidentes na demonstração, no
  máximo 30 por hora (a cota). Se houver abuso, `python -m app.dispositivos desativar <id>`
  corta o acesso; o seed não reativa um dispositivo desativado.
- Se a central remover o incidente, um reenvio tardio da mesma chave responde **409**
  (`ja_recebido`) em vez de recriar o que a central decidiu apagar.
- O registro de idempotência não expira. Em produção real, um job limparia chaves antigas.
