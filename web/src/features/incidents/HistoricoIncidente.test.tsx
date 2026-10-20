import { QueryClientProvider } from '@tanstack/react-query'
import { render, screen } from '@testing-library/react'
import { afterEach, expect, it, vi } from 'vitest'
import type { EventoIncidente } from '@/api/tipos'
import { criarClienteDeConsultas } from '@/lib/consultas'
import { ANA, incidente, respostaJson } from '@/test/fabricas'
import { HistoricoIncidente } from './HistoricoIncidente'

afterEach(() => vi.unstubAllGlobals())

it('mostra o comentário do analista abaixo do evento', async () => {
  const fechado: EventoIncidente = {
    id: 2,
    tipo: 'status',
    analista: ANA,
    status_anterior: 'em_investigacao',
    status_novo: 'fechado',
    campos: null,
    comentario: 'Guincho removeu o veículo às 14h',
    criado_em: '2026-10-20T14:00:00Z',
  }
  vi.stubGlobal('fetch', vi.fn(async () => respostaJson(200, [fechado])))
  render(
    <QueryClientProvider client={criarClienteDeConsultas()}>
      <HistoricoIncidente
        incidente={incidente({ id: 3, status: 'fechado' })}
        idAnalista={ANA.id}
        agora={Date.parse('2026-10-20T15:00:00Z')}
      />
    </QueryClientProvider>,
  )

  const comentario = await screen.findByText('Guincho removeu o veículo às 14h')
  expect(comentario.tagName).toBe('BLOCKQUOTE')
})
