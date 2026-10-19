import { QueryClientProvider } from '@tanstack/react-query'
import { render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { criarClienteDeConsultas } from '@/lib/consultas'
import App from './App'

function renderizar() {
  const cliente = criarClienteDeConsultas()
  // Nos testes, a falha deve aparecer na hora, sem esperar as novas tentativas.
  cliente.setDefaultOptions({ queries: { retry: false } })
  return render(
    <QueryClientProvider client={cliente}>
      <App />
    </QueryClientProvider>,
  )
}

describe('App', () => {
  afterEach(() => vi.unstubAllGlobals())

  it('mostra o nome do produto', () => {
    vi.stubGlobal('fetch', vi.fn(() => new Promise(() => {})))
    renderizar()

    expect(screen.getByRole('heading', { name: 'Logos' })).toBeInTheDocument()
  })

  it('informa quando a API responde', async () => {
    vi.stubGlobal('fetch', vi.fn(() => Promise.resolve(Response.json({ status: 'ok', banco: 'ok' }))))
    renderizar()

    expect(await screen.findByText('API: ok')).toBeInTheDocument()
  })

  it('informa quando a API está fora do ar', async () => {
    vi.stubGlobal('fetch', vi.fn(() => Promise.reject(new TypeError('falha de rede'))))
    renderizar()

    expect(await screen.findByText('API: indisponivel')).toBeInTheDocument()
  })
})
