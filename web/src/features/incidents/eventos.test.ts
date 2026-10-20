import { describe, expect, it } from 'vitest'
import type { EventoIncidente } from '@/api/tipos'
import { ANA, BRUNO } from '@/test/fabricas'
import { descreverEvento } from './eventos'

function evento(dados: Partial<EventoIncidente>): EventoIncidente {
  return {
    id: 1,
    tipo: 'criado',
    analista: null,
    status_anterior: null,
    status_novo: 'aberto',
    campos: null,
    comentario: null,
    criado_em: '2026-10-19T12:00:00Z',
    ...dados,
  }
}

describe('descreverEvento', () => {
  it('escreve cada tipo de evento do ponto de vista de quem lê', () => {
    expect(descreverEvento(evento({}), ANA.id)).toBe('Incidente registrado')
    expect(descreverEvento(evento({ analista: ANA }), ANA.id)).toBe('Você registrou o incidente')
    expect(descreverEvento(evento({ tipo: 'assumido', analista: BRUNO }), ANA.id)).toBe(
      'Bruno Lima assumiu o incidente',
    )
    expect(
      descreverEvento(
        evento({
          tipo: 'status',
          analista: BRUNO,
          status_anterior: 'em_investigacao',
          status_novo: 'inconclusivo',
        }),
        ANA.id,
      ),
    ).toBe('Bruno Lima mudou o status de Em Investigação para Inconclusivo')
  })

  it('liberar diz para onde o incidente voltou só quando o status mudou', () => {
    const base = { tipo: 'liberado' as const, analista: ANA }
    expect(
      descreverEvento(
        evento({ ...base, status_anterior: 'em_investigacao', status_novo: 'aberto' }),
        ANA.id,
      ),
    ).toBe('Você liberou o incidente, que voltou para Aberto')
    expect(
      descreverEvento(
        evento({ ...base, status_anterior: 'inconclusivo', status_novo: 'inconclusivo' }),
        ANA.id,
      ),
    ).toBe('Você liberou o incidente')
  })

  it('edição lista os campos em português', () => {
    expect(
      descreverEvento(
        evento({ tipo: 'editado', analista: BRUNO, campos: ['titulo', 'local', 'placa'] }),
        ANA.id,
      ),
    ).toBe('Bruno Lima editou o título, o local e a placa')
    expect(descreverEvento(evento({ tipo: 'editado', analista: BRUNO, campos: [] }), ANA.id)).toBe(
      'Bruno Lima editou o incidente',
    )
  })
})

describe('descreverEvento — ingestão', () => {
  it('registro sem autor com origem vira "Recebido de …"', () => {
    expect(descreverEvento(evento({}), ANA.id, 'Simulador do caminhão RTA4E21')).toBe(
      'Recebido de Simulador do caminhão RTA4E21',
    )
  })
})
