import { describe, expect, it } from 'vitest'
import { variacao } from './variacao'

describe('variacao', () => {
  it('compara com o período anterior', () => {
    expect(variacao({ atual: 112, anterior: 100 })).toEqual({ pct: 12, direcao: 'sobe' })
    expect(variacao({ atual: 96, anterior: 100 })).toEqual({ pct: 4, direcao: 'desce' })
    expect(variacao({ atual: 5, anterior: 5 })).toEqual({ pct: 0, direcao: 'igual' })
  })

  it('sem base, não inventa variação', () => {
    expect(variacao({ atual: 3, anterior: 0 })).toBeNull()
    expect(variacao({ atual: null, anterior: 4 })).toBeNull()
  })
})
