import { requisitar } from './cliente'
import type { Saude } from './tipos'

export function verificarSaude(sinal?: AbortSignal): Promise<Saude> {
  return requisitar('/health', { sinal, autenticada: false })
}
