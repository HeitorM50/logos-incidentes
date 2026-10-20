/** Minutos inteiros entre o instante ISO e `agora` (nunca negativo). */
export function minutosDesde(iso: string, agora: number): number {
  return Math.max(0, Math.floor((agora - new Date(iso).getTime()) / 60_000))
}

/** "12 min", "4 h", "4 h 05 min", "2 d 3 h". Formato fixo para a coluna alinhar. */
export function formatarDuracao(minutos: number): string {
  if (minutos < 60) return `${minutos} min`
  const horas = Math.floor(minutos / 60)
  const resto = minutos % 60
  if (horas < 24) return `${horas} h${resto ? ` ${String(resto).padStart(2, '0')} min` : ''}`
  const dias = Math.floor(horas / 24)
  const horasRestantes = horas % 24
  return `${dias} d${horasRestantes ? ` ${horasRestantes} h` : ''}`
}

/** "agora", "há 12 min", "há 4 h 05 min", "há 2 d 3 h". */
export function formatarTempoAberto(minutos: number): string {
  if (minutos < 1) return 'agora'
  return `há ${formatarDuracao(minutos)}`
}

/**
 * Tempo da coluna "Tempo aberto". Ativo: desde quando está aberto ("há 2 h"). Fechado: quanto
 * ficou aberto até fechar ("2 h 05 min"); fechado é final, então `atualizado_em` é o fechamento.
 */
export function tempoDoIncidente(
  incidente: { status: string; criado_em: string; atualizado_em: string },
  agora: number,
): string {
  if (incidente.status !== 'fechado') {
    return formatarTempoAberto(minutosDesde(incidente.criado_em, agora))
  }
  const fim = new Date(incidente.atualizado_em).getTime()
  return formatarDuracao(minutosDesde(incidente.criado_em, fim))
}

/** "há 3 s", "há 2 min": idade da última atualização da lista. */
export function formatarSegundosAtras(segundos: number): string {
  if (segundos < 60) return `há ${segundos} s`
  return formatarTempoAberto(Math.floor(segundos / 60))
}
