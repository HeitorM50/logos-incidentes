import { useQuery } from '@tanstack/react-query'
import { verificarSaude } from '@/api/saude'

// Tela provisória até a tela de triagem (issue #16): confirma que o front alcança a API.
function App() {
  const saude = useQuery({
    queryKey: ['saude'],
    queryFn: ({ signal }) => verificarSaude(signal),
  })

  const estado = saude.isPending ? 'verificando' : saude.isSuccess ? 'ok' : 'indisponivel'

  return (
    <main className="mx-auto max-w-xl p-8">
      <h1 className="text-2xl font-semibold">Logos</h1>
      <p className="text-muted-foreground">Central de resposta a incidentes</p>
      <p role="status" className="mt-4">
        API: {estado}
      </p>
    </main>
  )
}

export default App
