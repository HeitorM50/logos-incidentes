import { describe, expect, it } from 'vitest'
import { formatarTelefone, lerTelefone, linkLigar, linkWhatsApp } from './telefone'

// Mesma regra de api/app/schemas/incidente.py (normalizar_telefone).
describe('telefone', () => {
  it.each([
    ['(11) 98765-4321', '+5511987654321'],
    ['11 3456-7890', '+551134567890'],
    ['+55 11 98765-4321', '+5511987654321'],
    ['', null],
    ['98765-4321', 'invalido'],
    ['+1 415 555 0100', 'invalido'],
  ])('lê "%s" como %s', (texto, esperado) => {
    expect(lerTelefone(texto)).toBe(esperado)
  })

  it('formata e monta os links', () => {
    expect(formatarTelefone('+5511987654321')).toBe('(11) 98765-4321')
    expect(formatarTelefone('+551134567890')).toBe('(11) 3456-7890')
    expect(linkLigar('+5511987654321')).toBe('tel:+5511987654321')
    expect(linkWhatsApp('+5511987654321')).toBe('https://wa.me/5511987654321')
  })
})
