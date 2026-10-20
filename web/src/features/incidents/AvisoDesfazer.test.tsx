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

    fireEvent.focus(screen.getByRole('button', { name: /Desfazer/ }))
    act(() => vi.advanceTimersByTime(DURACAO_DESFAZER_MS * 2))
    expect(aoExpirar).not.toHaveBeenCalled()

    fireEvent.blur(screen.getByRole('button', { name: /Desfazer/ }))
    act(() => vi.advanceTimersByTime(DURACAO_DESFAZER_MS))
    expect(aoExpirar).toHaveBeenCalledOnce()
  })

  it('Esc fecha', () => {
    const { aoFechar } = montar()
    fireEvent.keyDown(screen.getByRole('button', { name: /Desfazer/ }), { key: 'Escape' })
    expect(aoFechar).toHaveBeenCalledOnce()
  })

  it('o botão Desfazer e o X chamam as ações certas', () => {
    const aoDesfazer = vi.fn()
    const aoFechar = vi.fn()
    render(
      <AvisoDesfazer texto="x" aoDesfazer={aoDesfazer} aoFechar={aoFechar} aoExpirar={() => {}} />,
    )
    fireEvent.click(screen.getByRole('button', { name: /Desfazer/ }))
    fireEvent.click(screen.getByRole('button', { name: 'Fechar aviso de desfazer' }))
    expect(aoDesfazer).toHaveBeenCalledOnce()
    expect(aoFechar).toHaveBeenCalledOnce()
  })

  it('o mouse pausa a contagem; o toque não', () => {
    vi.useFakeTimers()
    const { aoExpirar } = montar()
    const caixa = screen.getByRole('button', { name: /Desfazer/ }).closest('div')!.parentElement!

    fireEvent.pointerEnter(caixa, { pointerType: 'mouse' })
    act(() => vi.advanceTimersByTime(DURACAO_DESFAZER_MS * 2))
    expect(aoExpirar).not.toHaveBeenCalled()

    fireEvent.pointerLeave(caixa, { pointerType: 'mouse' })
    fireEvent.pointerEnter(caixa, { pointerType: 'touch' })
    act(() => vi.advanceTimersByTime(DURACAO_DESFAZER_MS))
    expect(aoExpirar).toHaveBeenCalledOnce()
  })

  it('expira uma vez só', () => {
    vi.useFakeTimers()
    const { aoExpirar } = montar()
    act(() => vi.advanceTimersByTime(DURACAO_DESFAZER_MS * 3))
    expect(aoExpirar).toHaveBeenCalledOnce()
  })
})

