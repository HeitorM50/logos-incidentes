import '@testing-library/jest-dom/vitest'
import { cleanup } from '@testing-library/react'
import { afterEach } from 'vitest'

// Sem `globals: true` no Vitest, o Testing Library não desmonta a tela sozinho entre os testes.
afterEach(() => cleanup())

// O jsdom não implementa canvas e escreve um erro no console a cada getContext.
// Sem contexto, o FundoPontos simplesmente não desenha.
HTMLCanvasElement.prototype.getContext = () => null
