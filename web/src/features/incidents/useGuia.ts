import { useState } from 'react'

// Guia da triagem: aberto ou fechado, e a dica de primeiro acesso (some depois de vista).

const CHAVE_GUIA_VISTO = 'logos.guia-visto'
export const ID_BOTAO_AJUDA = 'botao-ajuda'

function lerVisto(): boolean {
  try {
    return localStorage.getItem(CHAVE_GUIA_VISTO) === '1'
  } catch {
    return false
  }
}

function marcarVisto() {
  try {
    localStorage.setItem(CHAVE_GUIA_VISTO, '1')
  } catch {
    // Sem armazenamento: a dica volta na próxima visita, sem prejuízo.
  }
}

/** Estado do guia e da dica de primeiro acesso. */
export function useGuia() {
  const [aberto, setAberto] = useState(false)
  const [mostrarDica, setMostrarDica] = useState(() => !lerVisto())

  function abrir() {
    marcarVisto()
    setMostrarDica(false)
    setAberto(true)
  }

  function dispensarDica() {
    marcarVisto()
    setMostrarDica(false)
  }

  return { aberto, setAberto, abrir, mostrarDica, dispensarDica }
}
