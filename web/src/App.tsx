import { useEffect, useState } from 'react'

type EstadoApi = 'verificando' | 'ok' | 'indisponivel'

const API_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:8000'

// Esqueleto de deploy (issue #12): confirma que o front publicado alcança a API publicada.
function App() {
  const [estado, setEstado] = useState<EstadoApi>('verificando')

  useEffect(() => {
    fetch(`${API_URL}/health`)
      .then((resposta) => setEstado(resposta.ok ? 'ok' : 'indisponivel'))
      .catch(() => setEstado('indisponivel'))
  }, [])

  return (
    <main>
      <h1>Logos</h1>
      <p>Central de resposta a incidentes</p>
      <p role="status">API: {estado}</p>
    </main>
  )
}

export default App
