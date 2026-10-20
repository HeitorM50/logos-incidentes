// Telefone do motorista. A API grava +55DDDNÚMERO (E.164); a tela mostra "(11) 98765-4321".

/** Lê o que foi digitado: null quando vazio, 'invalido' quando não é um número do Brasil. */
export function lerTelefone(texto: string): string | null | 'invalido' {
  let digitos = texto.replace(/\D/g, '')
  if (!digitos) return null
  const internacional = texto.trim().startsWith('+')
  if (internacional && !digitos.startsWith('55')) return 'invalido'
  if ((internacional || digitos.length > 11) && digitos.startsWith('55')) digitos = digitos.slice(2)
  if (digitos.length !== 10 && digitos.length !== 11) return 'invalido'
  return `+55${digitos}`
}

/** "+5511987654321" → "(11) 98765-4321". */
export function formatarTelefone(e164: string): string {
  const nacional = e164.replace(/^\+55/, '')
  const ddd = nacional.slice(0, 2)
  const numero = nacional.slice(2)
  const corte = numero.length - 4
  return `(${ddd}) ${numero.slice(0, corte)}-${numero.slice(corte)}`
}

export const linkLigar = (e164: string) => `tel:${e164}`
export const linkWhatsApp = (e164: string) => `https://wa.me/${e164.replace(/^\+/, '')}`
