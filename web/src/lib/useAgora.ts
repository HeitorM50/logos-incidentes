import { useEffect, useState } from 'react'

/** Date.now() atualizado a cada `intervaloMs`, para textos relativos ("há 12 min"). */
export function useAgora(intervaloMs: number): number {
  const [agora, setAgora] = useState(() => Date.now())
  useEffect(() => {
    const id = setInterval(() => setAgora(Date.now()), intervaloMs)
    return () => clearInterval(id)
  }, [intervaloMs])
  return agora
}
