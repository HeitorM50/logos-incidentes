import { useEffect, useState } from 'react'

/**
 * Segundos inteiros desde que `aguardando` virou verdadeiro; zero quando não está aguardando.
 * Serve para mostrar "acordando o servidor" só quando a espera passa do normal.
 */
export function useSegundosAguardando(aguardando: boolean): number {
  const [segundos, setSegundos] = useState(0)

  useEffect(() => {
    if (!aguardando) return
    const inicio = Date.now()
    const intervalo = setInterval(() => {
      setSegundos(Math.floor((Date.now() - inicio) / 1000))
    }, 1000)
    return () => {
      clearInterval(intervalo)
      setSegundos(0)
    }
  }, [aguardando])

  return aguardando ? segundos : 0
}
