import { describe, expect, it } from 'vitest'
import {
  formatarSegundosAtras,
  formatarTempoAberto,
  minutosDesde,
  tempoDoIncidente,
} from './tempo'

describe('tempo', () => {
  it.each([
    [0, 'agora'],
    [12, 'há 12 min'],
    [60, 'há 1 h'],
    [65, 'há 1 h 05 min'],
    [270, 'há 4 h 30 min'],
    [24 * 60, 'há 1 d'],
    [27 * 60 + 10, 'há 1 d 3 h'],
  ])('formata %i minutos como "%s"', (minutos, esperado) => {
    expect(formatarTempoAberto(minutos)).toBe(esperado)
  })

  it('calcula os minutos desde a criação e nunca devolve negativo', () => {
    const agora = Date.parse('2026-10-19T12:00:00Z')
    expect(minutosDesde('2026-10-19T11:29:59Z', agora)).toBe(30)
    // Relógio do analista atrasado em relação ao servidor.
    expect(minutosDesde('2026-10-19T12:01:00Z', agora)).toBe(0)
  })

  it('ativo conta desde a abertura; fechado mostra quanto ficou aberto até fechar', () => {
    const agora = Date.parse('2026-10-20T15:00:00Z')
    const base = { criado_em: '2026-10-20T10:00:00Z', atualizado_em: '2026-10-20T11:05:00Z' }
    expect(tempoDoIncidente({ ...base, status: 'aberto' }, agora)).toBe('há 5 h')
    expect(tempoDoIncidente({ ...base, status: 'fechado' }, agora)).toBe('1 h 05 min')
  })

  it('formata a idade da última atualização', () => {
    expect(formatarSegundosAtras(2)).toBe('há 2 s')
    expect(formatarSegundosAtras(125)).toBe('há 2 min')
  })
})
