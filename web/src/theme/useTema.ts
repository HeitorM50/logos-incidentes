import { useSyncExternalStore } from 'react'
import { aoMudarTema, definirTema, lerTema, type Origem, type Tema } from './tema'

export function useTema(): { tema: Tema; alternarTema: (origem?: Origem) => void } {
  const tema = useSyncExternalStore(aoMudarTema, lerTema)
  return {
    tema,
    alternarTema: (origem) => definirTema(tema === 'claro' ? 'escuro' : 'claro', origem),
  }
}
