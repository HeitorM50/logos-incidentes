import { act, renderHook } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { Incidente } from '@/api/tipos'
import { ANA, BRUNO, incidente } from '@/test/fabricas'
import { DURACAO_DESTAQUE_MS, useAltaNova } from './useAltaNova'

const TITULO = 'Logos — Central de Incidentes'

function montar(inicial: Incidente[] | undefined) {
  return renderHook(({ itens }) => useAltaNova(itens, ANA.id, TITULO), {
    initialProps: { itens: inicial },
  })
}

function ocultarAba(oculta: boolean) {
  Object.defineProperty(document, 'hidden', { configurable: true, get: () => oculta })
  document.dispatchEvent(new Event('visibilitychange'))
}

afterEach(() => {
  vi.useRealTimers()
  ocultarAba(false)
})

const base = [incidente({ id: 1, criticidade: 'alta' }), incidente({ id: 2, criticidade: 'media' })]

describe('useAltaNova', () => {
  it('a primeira leitura não avisa: tudo ali já existia', () => {
    const { result } = montar(base)
    expect(result.current.aviso).toBeNull()
    expect(result.current.destaques.size).toBe(0)
  })

  it('avisa e destaca um Alta novo de outro analista, e o destaque some depois', () => {
    vi.useFakeTimers()
    const { result, rerender } = montar(base)

    const novo = incidente({ id: 9, criticidade: 'alta', titulo: 'Tombamento', atualizado_por: BRUNO })
    rerender({ itens: [...base, novo] })

    expect(result.current.aviso).toEqual({ ids: [9], titulo: 'Tombamento' })
    expect(result.current.anuncio).toBe('Novo incidente Alta: #9, Tombamento.')
    expect(result.current.destaques.has(9)).toBe(true)

    act(() => vi.advanceTimersByTime(DURACAO_DESTAQUE_MS))
    expect(result.current.destaques.has(9)).toBe(false)
    // O aviso fica até o analista ver ou fechar.
    expect(result.current.aviso).not.toBeNull()
  })

  it('o destaque de um Alta não some antes da hora por causa de outra leitura', () => {
    vi.useFakeTimers()
    const { result, rerender } = montar(base)
    const primeiro = incidente({ id: 9, criticidade: 'alta', atualizado_por: BRUNO })
    rerender({ itens: [...base, primeiro] })

    act(() => vi.advanceTimersByTime(5_000))
    const segundo = incidente({ id: 10, criticidade: 'alta', atualizado_por: BRUNO })
    rerender({ itens: [...base, primeiro, segundo] })
    expect(result.current.aviso?.ids).toEqual([9, 10])

    act(() => vi.advanceTimersByTime(DURACAO_DESTAQUE_MS - 5_000))
    expect([...result.current.destaques]).toEqual([10])
  })

  it('não avisa o que o próprio analista criou ou mudou', () => {
    const { result, rerender } = montar(base)
    rerender({ itens: [...base, incidente({ id: 9, criticidade: 'alta', atualizado_por: ANA })] })
    expect(result.current.aviso).toBeNull()
  })

  it('avisa quem subiu para Alta; não avisa Alta que fechou', () => {
    const { result, rerender } = montar(base)
    rerender({
      itens: [
        incidente({ id: 1, criticidade: 'alta', status: 'fechado', atualizado_por: BRUNO }),
        incidente({ id: 2, criticidade: 'alta', atualizado_por: BRUNO }),
      ],
    })
    expect(result.current.aviso?.ids).toEqual([2])
  })

  it('com a aba em segundo plano, conta no título até o analista voltar', () => {
    const { rerender } = montar(base)
    ocultarAba(true)

    rerender({ itens: [...base, incidente({ id: 9, criticidade: 'alta', atualizado_por: BRUNO })] })
    expect(document.title).toBe(`(1) ${TITULO}`)

    act(() => ocultarAba(false))
    expect(document.title).toBe(TITULO)
  })
})
