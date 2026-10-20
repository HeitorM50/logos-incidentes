import { useQueryClient } from '@tanstack/react-query'
import { useEffect, useState } from 'react'
import { aoExpirarSessao, encerrarSessao, lerSessao } from '@/api/sessao'
import type { AnalistaLogado } from '@/api/tipos'
import { TelaAbertura } from '@/components/TelaAbertura'
import { TelaLogin } from '@/features/auth/TelaLogin'
import { TelaTriagem } from '@/features/incidents/TelaTriagem'

// A abertura dura um ciclo completo do loader (2 s) e some em 300 ms.
const DURACAO_ABERTURA_MS = 2_000
// 300 ms de saída + 80 ms de folga: o loader termina o voo até a marca antes de desmontar.
const DURACAO_SAIDA_ABERTURA_MS = 380

type FaseAbertura = 'oculta' | 'visivel' | 'saindo'

function App() {
  const clienteDeConsultas = useQueryClient()
  const [analista, setAnalista] = useState<AnalistaLogado | null>(
    () => lerSessao()?.analista ?? null,
  )
  const [abertura, setAbertura] = useState<FaseAbertura>('oculta')

  // A API recusou o token (expirado ou inválido): volta para o login sem dados de outra sessão.
  useEffect(
    () =>
      aoExpirarSessao(() => {
        clienteDeConsultas.clear()
        setAnalista(null)
      }),
    [clienteDeConsultas],
  )

  useEffect(() => {
    if (abertura === 'oculta') return
    const proxima = abertura === 'visivel' ? 'saindo' : 'oculta'
    const espera = abertura === 'visivel' ? DURACAO_ABERTURA_MS : DURACAO_SAIDA_ABERTURA_MS
    const id = setTimeout(() => setAbertura(proxima), espera)
    return () => clearTimeout(id)
  }, [abertura])

  function entrar(novoAnalista: AnalistaLogado) {
    setAnalista(novoAnalista)
    setAbertura('visivel')
  }

  function sair() {
    encerrarSessao()
    clienteDeConsultas.clear()
    setAnalista(null)
    setAbertura('oculta')
  }

  if (!analista) return <TelaLogin aoEntrar={entrar} />

  return (
    <>
      {/* A triagem monta por baixo da abertura (a lista já começa a carregar), mas fica
          inerte até a abertura sair: sem foco por Tab e fora do leitor de tela. */}
      <div inert={abertura !== 'oculta'}>
        <TelaTriagem analista={analista} aoSair={sair} />
      </div>
      {abertura !== 'oculta' && <TelaAbertura saindo={abertura === 'saindo'} />}
    </>
  )
}

export default App
