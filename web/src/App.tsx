import { useQueryClient } from '@tanstack/react-query'
import { useEffect, useState } from 'react'
import { aoExpirarSessao, encerrarSessao, lerSessao } from '@/api/sessao'
import type { AnalistaLogado } from '@/api/tipos'
import { BotaoTema } from '@/components/BotaoTema'
import { MarcaLogos } from '@/components/MarcaLogos'
import { Button } from '@/components/ui/button'
import { TelaLogin } from '@/features/auth/TelaLogin'

function App() {
  const clienteDeConsultas = useQueryClient()
  const [analista, setAnalista] = useState<AnalistaLogado | null>(
    () => lerSessao()?.analista ?? null,
  )

  // A API recusou o token (expirado ou inválido): volta para o login sem dados de outra sessão.
  useEffect(
    () =>
      aoExpirarSessao(() => {
        clienteDeConsultas.clear()
        setAnalista(null)
      }),
    [clienteDeConsultas],
  )

  function sair() {
    encerrarSessao()
    clienteDeConsultas.clear()
    setAnalista(null)
  }

  if (!analista) return <TelaLogin aoEntrar={setAnalista} />

  // Provisório até a tela de triagem (issue #16).
  return (
    <div className="flex min-h-svh flex-col">
      <header className="flex items-center justify-between gap-4 border-b px-4 py-3 sm:px-6">
        <MarcaLogos />
        <div className="flex items-center gap-3">
          <BotaoTema />
          <span className="text-sm">{analista.nome}</span>
          <Button variant="link" onClick={sair} className="px-0 underline">
            Sair
          </Button>
        </div>
      </header>
      <main className="p-6">
        <h1 className="text-xl font-semibold">Triagem</h1>
        <p className="text-texto-2">A lista de incidentes entra na próxima etapa.</p>
      </main>
    </div>
  )
}

export default App
