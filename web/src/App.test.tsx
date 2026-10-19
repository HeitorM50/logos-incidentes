import { render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import App from './App'

describe('App', () => {
  afterEach(() => vi.unstubAllGlobals())

  it('mostra o nome do produto', () => {
    vi.stubGlobal('fetch', vi.fn(() => new Promise(() => {})))
    render(<App />)

    expect(screen.getByRole('heading', { name: 'Logos' })).toBeInTheDocument()
  })

  it('informa quando a API responde', async () => {
    vi.stubGlobal('fetch', vi.fn(() => Promise.resolve(new Response('{}', { status: 200 }))))
    render(<App />)

    expect(await screen.findByText('API: ok')).toBeInTheDocument()
  })

  it('informa quando a API está fora do ar', async () => {
    vi.stubGlobal('fetch', vi.fn(() => Promise.reject(new TypeError('falha de rede'))))
    render(<App />)

    expect(await screen.findByText('API: indisponivel')).toBeInTheDocument()
  })
})
