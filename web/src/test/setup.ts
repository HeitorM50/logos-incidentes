import '@testing-library/jest-dom/vitest'
import { cleanup, configure } from '@testing-library/react'
import { afterEach } from 'vitest'

// Sem `globals: true` no Vitest, o Testing Library não desmonta a tela sozinho entre os testes.
afterEach(() => cleanup())

// Com a suíte inteira em paralelo, o jsdom fica lento e a espera padrão de 1 s das buscas
// assíncronas (findBy, waitFor) estoura sem haver erro no código.
configure({ asyncUtilTimeout: 4000 })

// O jsdom não implementa canvas e escreve um erro no console a cada getContext.
// Sem contexto, o FundoPontos simplesmente não desenha.
HTMLCanvasElement.prototype.getContext = () => null
