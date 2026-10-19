/** Minutos inteiros entre o instante ISO e `agora` (nunca negativo). */
export function minutosDesde(iso: string, agora: number): number {
  return Math.max(0, Math.floor((agora - new Date(iso).getTime()) / 60_000))
}

/** "há 12 min", "há 4 h", "há 4 h 05 min", "há 2 d 3 h". Formato fixo para a coluna alinhar. */
export function formatarTempoAberto(minutos: number): string {
  if (minutos < 1) return 'agora'
  if (minutos < 60) return `há ${minutos} min`
  const horas = Math.floor(minutos / 60)
  const resto = minutos % 60
  if (horas < 24) return `há ${horas} h${resto ? ` ${String(resto).padStart(2, '0')} min` : ''}`
  const dias = Math.floor(horas / 24)
  const horasRestantes = horas % 24
  return `há ${dias} d${horasRestantes ? ` ${horasRestantes} h` : ''}`
}

/** "há 3 s", "há 2 min": idade da última atualização da lista. */
export function formatarSegundosAtras(segundos: number): string {
  if (segundos < 60) return `há ${segundos} s`
  return formatarTempoAberto(Math.floor(segundos / 60))
}
