import { useEffect, useState } from 'react'

/** Devolve `valor` só depois que ele fica `esperaMs` sem mudar. */
export function useValorAtrasado<T>(valor: T, esperaMs: number): T {
  const [atrasado, setAtrasado] = useState(valor)
  useEffect(() => {
    const id = setTimeout(() => setAtrasado(valor), esperaMs)
    return () => clearTimeout(id)
  }, [valor, esperaMs])
  return atrasado
}
