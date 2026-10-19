import { afterEach, describe, expect, it, vi } from 'vitest'
import { encerrarSessao, lerSessao, salvarSessao } from './sessao'

const ANALISTA = { id: 1, nome: 'Ana Souza', usuario: 'ana' }

afterEach(() => {
  vi.restoreAllMocks()
  encerrarSessao()
  localStorage.clear()
})

describe('sessão', () => {
  it('descarta sessão salva já expirada', () => {
    localStorage.setItem(
      'logos.sessao',
      JSON.stringify({ token: 't', expiraEm: '2000-01-01T00:00:00Z', analista: ANALISTA }),
    )

    expect(lerSessao()).toBeNull()
    expect(localStorage.getItem('logos.sessao')).toBeNull()
  })

  it('continua funcionando em memória se o localStorage estiver bloqueado', () => {
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new DOMException('bloqueado', 'SecurityError')
    })
    const sessao = { token: 't', expiraEm: new Date(Date.now() + 60_000).toISOString(), analista: ANALISTA }

    expect(() => salvarSessao(sessao)).not.toThrow()
    expect(lerSessao()).toEqual(sessao)
  })

  it('ignora conteúdo corrompido no armazenamento', () => {
    localStorage.setItem('logos.sessao', '{isto não é json')

    expect(lerSessao()).toBeNull()
  })
})
