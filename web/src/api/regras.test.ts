import { describe, expect, it } from 'vitest'
import { REGRAS } from './regras'
import dados from './regras.json'
import { CRITICIDADES, STATUS } from './tipos'

// O conteúdo de regras.json é conferido contra o código da API em api/tests/test_regras.py.
// Aqui, o front confere que entende tudo o que veio de lá.
describe('regras geradas pela API', () => {
  it('todo status citado existe no front', () => {
    const citados = [
      ...Object.keys(dados.transicoes_do_responsavel),
      ...Object.values(dados.transicoes_do_responsavel).flat(),
      ...dados.pode_assumir,
      ...Object.keys(dados.status_apos_liberar),
      ...Object.values(dados.status_apos_liberar),
      ...dados.status_final,
      ...dados.comentario.obrigatorio_para,
    ]
    for (const status of citados) expect(STATUS).toContain(status)
    // Liberar tem resposta para todo status.
    expect(Object.keys(dados.status_apos_liberar).sort()).toEqual([...STATUS].sort())
  })

  it('limites e padrão da placa têm o formato que o formulário usa', () => {
    expect(REGRAS.limites.titulo.min).toBeLessThan(REGRAS.limites.titulo.max)
    expect(REGRAS.limites.local.min).toBeLessThan(REGRAS.limites.local.max)
    expect(REGRAS.limites.descricao.max).toBeGreaterThan(0)
    expect(REGRAS.padraoPlaca.test('ABC1D23')).toBe(true)
    expect(REGRAS.padraoPlaca.test('ABC-1D23')).toBe(false)
    expect(REGRAS.comentario.min).toBeLessThan(REGRAS.comentario.max)
    expect(Object.keys(REGRAS.prazoParaAssumirMin).sort()).toEqual([...CRITICIDADES].sort())
  })
})
