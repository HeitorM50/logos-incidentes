import { act, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { AvisoDesfazer, DURACAO_DESFAZER_MS } from './Avisos'

afterEach(() => vi.useRealTimers())

function montar() {
  const aoExpirar = vi.fn()
  const aoFechar = vi.fn()
  render(
    <AvisoDesfazer
      texto="Você assumiu #7."
      aoDesfazer={() => {}}
      aoFechar={aoFechar}
      aoExpirar={aoExpirar}
    />,
  )
  return { aoExpirar, aoFechar }
}

describe('AvisoDesfazer', () => {
  it('some sozinho depois de 6 s', () => {
    vi.useFakeTimers()
    const { aoExpirar } = montar()

    act(() => vi.advanceTimersByTime(DURACAO_DESFAZER_MS - 200))
    expect(aoExpirar).not.toHaveBeenCalled()
    act(() => vi.advanceTimersByTime(200))
    expect(aoExpirar).toHaveBeenCalledOnce()
  })

  it('a contagem para enquanto o foco está no aviso (WCAG 2.2.1)', () => {
    vi.useFakeTimers()
    const { aoExpirar } = montar()

    fireEvent.focus(screen.getByRole('button', { name: 'Desfazer' }))
    act(() => vi.advanceTimersByTime(DURACAO_DESFAZER_MS * 2))
    expect(aoExpirar).not.toHaveBeenCalled()

    fireEvent.blur(screen.getByRole('button', { name: 'Desfazer' }))
    act(() => vi.advanceTimersByTime(DURACAO_DESFAZER_MS))
    expect(aoExpirar).toHaveBeenCalledOnce()
  })

  it('Esc fecha', () => {
    const { aoFechar } = montar()
    fireEvent.keyDown(screen.getByRole('button', { name: 'Desfazer' }), { key: 'Escape' })
    expect(aoFechar).toHaveBeenCalledOnce()
  })
})
