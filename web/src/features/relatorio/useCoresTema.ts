import { useEffect, useState } from 'react'
import { aoMudarTema } from '@/theme/tema'

// Os gráficos (reaviz) pintam SVG com cores literais: var(--token) não vale em todo atributo.
// Este hook lê os tokens já resolvidos e relê quando o tema muda.

const TOKENS = ['--foreground', '--texto-2', '--texto-3', '--border', '--info-borda', '--alta-borda'] as const
type Token = (typeof TOKENS)[number]

function ler(): Record<Token, string> {
  const estilo = getComputedStyle(document.documentElement)
  return Object.fromEntries(
    TOKENS.map((t) => [t, estilo.getPropertyValue(t).trim() || '#888888']),
  ) as Record<Token, string>
}

export function useCoresTema(): Record<Token, string> {
  const [cores, setCores] = useState(ler)
  useEffect(() => aoMudarTema(() => setCores(ler())), [])
  return cores
}
