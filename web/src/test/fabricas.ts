import type { Incidente, ListaIncidentes } from '@/api/tipos'

// Dados de teste compartilhados entre os testes de tela.

export const ANA = { id: 1, nome: 'Ana Souza', usuario: 'ana' }
export const BRUNO = { id: 2, nome: 'Bruno Lima' }

export function respostaJson(status: number, corpo: unknown): Response {
  return new Response(JSON.stringify(corpo), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}

export function erroDaApi(
  status: number,
  codigo: string,
  extra: { mensagem?: string; atual?: Incidente; campos?: { campo: string; mensagem: string }[] } = {},
): Response {
  return respostaJson(status, { erro: { codigo, mensagem: extra.mensagem ?? codigo, ...extra } })
}

export const nunca = () => new Promise<Response>(() => {})

export function incidente(dados: Partial<Incidente> = {}): Incidente {
  return {
    id: 1,
    titulo: 'Pneu estourado no eixo traseiro',
    descricao: null,
    categoria: 'problema_mecanico',
    criticidade: 'media',
    status: 'aberto',
    local: 'BR-116, km 212 — Registro/SP',
    placa: null,
    responsavel: null,
    atualizado_por: null,
    dispositivo: null,
    versao: 1,
    // 30 min e 30 s: a tela lê o relógio um pouco antes da resposta chegar e ainda mostra 30 min.
    criado_em: new Date(Date.now() - 30.5 * 60_000).toISOString(),
    atualizado_em: new Date(Date.now() - 30.5 * 60_000).toISOString(),
    ...dados,
  }
}

export function lista(itens: Incidente[]): ListaIncidentes {
  const contagem = { alta: 0, media: 0, baixa: 0 }
  for (const item of itens) contagem[item.criticidade]++
  return { itens, total: itens.length, contagem_por_criticidade: contagem }
}
