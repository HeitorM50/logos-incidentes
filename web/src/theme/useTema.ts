import { useSyncExternalStore } from 'react'
import { aoMudarTema, definirTema, lerTema, type Tema } from './tema'

export function useTema(): { tema: Tema; alternarTema: () => void } {
  const tema = useSyncExternalStore(aoMudarTema, lerTema)
  return {
    tema,
    alternarTema: () => definirTema(tema === 'claro' ? 'escuro' : 'claro'),
  }
}
