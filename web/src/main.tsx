import { QueryClientProvider } from '@tanstack/react-query'
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App'
import { criarClienteDeConsultas } from './lib/consultas'
import './index.css'
import { seguirTemaDoSistema } from './theme/tema'

const clienteDeConsultas = criarClienteDeConsultas()
seguirTemaDoSistema()

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <QueryClientProvider client={clienteDeConsultas}>
      <App />
    </QueryClientProvider>
  </StrictMode>,
)
