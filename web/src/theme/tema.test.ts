import { afterEach, describe, expect, it, vi } from 'vitest'
import { aoMudarTema, definirTema, lerTema, seguirTemaDoSistema } from './tema'

afterEach(() => {
  document.documentElement.className = ''
  localStorage.clear()
  vi.useRealTimers()
})

describe('tema', () => {
  it('troca a classe do <html>, guarda a escolha e avisa os ouvintes', () => {
    const ouvinte = vi.fn()
    const parar = aoMudarTema(ouvinte)

    definirTema('escuro')

    expect(lerTema()).toBe('escuro')
    expect(document.documentElement).toHaveClass('dark')
    expect(localStorage.getItem('logos.tema')).toBe('escuro')
    expect(ouvinte).toHaveBeenCalledOnce()
    parar()
  })

  it('liga a transição só durante a troca', () => {
    vi.useFakeTimers()

    definirTema('escuro')
    expect(document.documentElement).toHaveClass('tema-em-transicao')

    vi.advanceTimersByTime(300)
    expect(document.documentElement).not.toHaveClass('tema-em-transicao')
  })

  it('sem escolha salva, acompanha o tema do sistema; com escolha, ignora', () => {
    let aoMudar: ((e: { matches: boolean }) => void) | undefined
    vi.stubGlobal('matchMedia', () => ({
      matches: false,
      addEventListener: (_: string, f: typeof aoMudar) => (aoMudar = f),
      removeEventListener: () => {},
    }))
    const parar = seguirTemaDoSistema()

    aoMudar!({ matches: true })
    expect(lerTema()).toBe('escuro')
    expect(localStorage.getItem('logos.tema')).toBeNull()

    definirTema('claro')
    aoMudar!({ matches: true })
    expect(lerTema()).toBe('claro')
    parar()
    vi.unstubAllGlobals()
  })

  it('com View Transitions, revela em círculo; sem a API, usa a transição comum', async () => {
    const animar = vi.fn()
    document.documentElement.animate = animar
    let callback: (() => unknown) | undefined
    const iniciar = vi.fn((cb: () => unknown) => {
      callback = cb
      return { ready: Promise.resolve(), finished: Promise.resolve() }
    })
    vi.stubGlobal('matchMedia', () => ({ matches: false }))
    Object.defineProperty(document, 'startViewTransition', { configurable: true, value: iniciar })

    definirTema('escuro', { x: 10, y: 20 })
    callback?.()
    await Promise.resolve()

    expect(iniciar).toHaveBeenCalledOnce()
    expect(lerTema()).toBe('escuro')
    expect(document.documentElement).not.toHaveClass('tema-em-transicao')
    expect(animar.mock.calls[0][1]).toMatchObject({ pseudoElement: '::view-transition-new(root)' })
    // As transições de cor ficam desligadas só durante a View Transition.
    await Promise.resolve()
    expect(document.documentElement).not.toHaveClass('tema-instantaneo')

    // Sem a API: a troca usa a transição de cores.
    Object.defineProperty(document, 'startViewTransition', { configurable: true, value: undefined })
    definirTema('claro', { x: 10, y: 20 })
    expect(lerTema()).toBe('claro')
    expect(document.documentElement).toHaveClass('tema-em-transicao')
    vi.unstubAllGlobals()
  })
})

