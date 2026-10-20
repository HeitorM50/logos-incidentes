import type { Metrica } from '@/api/relatorio'

export interface Variacao {
  /** Diferença percentual arredondada, sem sinal. */
  pct: number
  direcao: 'sobe' | 'desce' | 'igual'
}

/** Variação do período anterior para o atual; null quando não há base para comparar. */
export function variacao({ atual, anterior }: Metrica): Variacao | null {
  if (atual === null || anterior === null || anterior === 0) return null
  const pct = Math.round(((atual - anterior) / anterior) * 100)
  return { pct: Math.abs(pct), direcao: pct > 0 ? 'sobe' : pct < 0 ? 'desce' : 'igual' }
}
