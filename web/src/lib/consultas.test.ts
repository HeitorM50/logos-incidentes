import { describe, expect, it } from 'vitest'
import { ErroApi } from '@/api/erros'
import { deveRepetir, esperaAntesDeRepetir } from './consultas'

const semConexao = new ErroApi({ status: 0, codigo: 'sem_conexao', mensagem: '' })
const conflito = new ErroApi({ status: 409, codigo: 'conflito_versao', mensagem: '' })

describe('política de repetição das leituras', () => {
  it('repete falhas passageiras até 3 vezes', () => {
    expect(deveRepetir(0, semConexao)).toBe(true)
    expect(deveRepetir(2, semConexao)).toBe(true)
    expect(deveRepetir(3, semConexao)).toBe(false)
  })

  it('não repete erros definitivos nem erros desconhecidos', () => {
    expect(deveRepetir(0, conflito)).toBe(false)
    expect(deveRepetir(0, new Error('bug'))).toBe(false)
  })

  it('usa backoff exponencial com teto', () => {
    expect([0, 1, 2, 5].map((falhas) => esperaAntesDeRepetir(falhas, semConexao))).toEqual([
      1000, 2000, 4000, 8000,
    ])
  })

  it('respeita o Retry-After da API', () => {
    const lento = new ErroApi({
      status: 503,
      codigo: 'servico_indisponivel',
      mensagem: '',
      tentarApos: 5,
    })

    expect(esperaAntesDeRepetir(0, lento)).toBe(5000)
  })
})
