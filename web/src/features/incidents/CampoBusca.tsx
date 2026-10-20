import { Search, X } from 'lucide-react'
import { useEffect, useRef } from 'react'

export const ID_CAMPO_BUSCA = 'busca-incidentes'

interface Props {
  valor: string
  aoMudar: (valor: string) => void
}

// Busca simples no front (sem paleta de comandos): título, local, placa ou número.
// Ctrl+K (ou ⌘K) e "/" levam o foco ao campo, como em outras ferramentas de triagem.
export function CampoBusca({ valor, aoMudar }: Props) {
  const campo = useRef<HTMLInputElement>(null)

  useEffect(() => {
    function aoTeclar(evento: KeyboardEvent) {
      if (evento.defaultPrevented || evento.isComposing) return
      // Com um diálogo aberto, o foco pertence a ele.
      if (document.querySelector('[aria-modal="true"]')) return
      const alvo = evento.target as HTMLElement | null
      const digitando =
        alvo?.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(alvo?.tagName ?? '')
      const comModificador = evento.ctrlKey || evento.metaKey || evento.altKey
      const atalhoK =
        (evento.ctrlKey || evento.metaKey) && !evento.altKey && evento.key.toLowerCase() === 'k'
      const atalhoBarra = evento.key === '/' && !comModificador && !digitando
      if (atalhoK || atalhoBarra) {
        evento.preventDefault()
        campo.current?.focus()
        campo.current?.select()
      }
    }
    window.addEventListener('keydown', aoTeclar)
    return () => window.removeEventListener('keydown', aoTeclar)
  }, [])

  return (
    <div
      role="search"
      className="relative flex max-w-[360px] min-w-[220px] flex-1 items-center max-sm:order-last max-sm:max-w-none max-sm:basis-full"
    >
      <label htmlFor={ID_CAMPO_BUSCA} className="sr-only">
        Buscar incidente
      </label>
      <Search aria-hidden className="pointer-events-none absolute left-3.5 size-4 text-texto-3" />
      <input
        ref={campo}
        id={ID_CAMPO_BUSCA}
        type="search"
        autoComplete="off"
        spellCheck={false}
        value={valor}
        onChange={(evento) => aoMudar(evento.target.value)}
        onKeyDown={(evento) => {
          if (evento.key === 'Escape' && valor) {
            evento.preventDefault()
            aoMudar('')
          }
        }}
        placeholder="Título, local, placa ou #número"
        className="h-[38px] w-full rounded-full border border-transparent bg-pilula pr-16 pl-9.5 text-sm outline-none placeholder:text-texto-3 focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 [&::-webkit-search-cancel-button]:hidden"
      />
      {valor ? (
        <button
          type="button"
          onClick={() => {
            aoMudar('')
            campo.current?.focus()
          }}
          aria-label="Limpar busca"
          className="absolute right-1.5 flex size-6 cursor-pointer items-center justify-center rounded text-texto-2 outline-none hover:bg-superficie-2 focus-visible:ring-3 focus-visible:ring-ring/50"
        >
          <X aria-hidden className="size-3.5" />
        </button>
      ) : (
        // Atalho de teclado: não serve para quem usa toque, então some no celular.
        <span aria-hidden className="pointer-events-none absolute right-2.5 flex gap-1 max-lg:hidden">
          <kbd className="rounded-md border bg-card px-1.5 font-mono text-[11px] text-texto-3">
            Ctrl
          </kbd>
          <kbd className="rounded-md border bg-card px-1.5 font-mono text-[11px] text-texto-3">
            K
          </kbd>
        </span>
      )}
    </div>
  )
}
