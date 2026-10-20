import { ROTULO_STATUS } from '@/api/rotulos'
import type { EventoIncidente } from '@/api/tipos'

// Texto de cada evento do histórico, do ponto de vista de quem lê ("Você" para si mesmo).

const NOME_CAMPO: Record<string, string> = {
  titulo: 'o título',
  descricao: 'a descrição',
  categoria: 'a categoria',
  criticidade: 'a criticidade',
  local: 'o local',
  placa: 'a placa',
}

function juntar(partes: string[]): string {
  if (partes.length <= 1) return partes.join('')
  return `${partes.slice(0, -1).join(', ')} e ${partes.at(-1)}`
}

/** "Bruno Lima mudou o status de Em Investigação para Inconclusivo". */
export function descreverEvento(
  evento: EventoIncidente,
  idAnalista: number,
  /** Nome do caminhão que enviou o incidente pela ingestão, se for o caso. */
  origem?: string,
): string {
  const autor = evento.analista
    ? evento.analista.id === idAnalista
      ? 'Você'
      : evento.analista.nome
    : null
  const de = evento.status_anterior ? ROTULO_STATUS[evento.status_anterior] : null
  const para = evento.status_novo ? ROTULO_STATUS[evento.status_novo] : null

  switch (evento.tipo) {
    case 'criado':
      if (autor) return `${autor} registrou o incidente`
      return origem ? `Recebido de ${origem}` : 'Incidente registrado'
    case 'assumido':
      return `${autor ?? 'Um analista'} assumiu o incidente`
    case 'liberado':
      return `${autor ?? 'Um analista'} liberou o incidente${
        para && para !== de ? `, que voltou para ${para}` : ''
      }`
    case 'status':
      return `${autor ?? 'Um analista'} mudou o status de ${de} para ${para}`
    case 'transferido': {
      const novo = evento.responsavel_novo
      const para = novo ? (novo.id === idAnalista ? 'você' : novo.nome) : 'outro analista'
      return `${autor ?? 'Um supervisor'} transferiu o incidente para ${para}`
    }
    case 'editado': {
      const campos = (evento.campos ?? []).map((c) => NOME_CAMPO[c] ?? c)
      return `${autor ?? 'Um analista'} editou ${campos.length ? juntar(campos) : 'o incidente'}`
    }
  }
}
