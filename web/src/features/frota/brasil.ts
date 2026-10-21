// Contorno do Brasil simplificado (longitude, latitude), só para dar contexto ao mapa da frota.
// Esquemático de propósito: sem mapa externo (a CSP só permite recursos do próprio site).
export const CONTORNO_BRASIL: [number, number][] = [
  [-60.7, 5.2], [-59.8, 4.2], [-58.0, 1.5], [-56.5, 1.9], [-54.0, 2.2], [-51.6, 4.2],
  [-50.4, 1.8], [-49.9, 0.5], [-48.5, -0.6], [-46.5, -1.0], [-44.4, -2.5], [-41.5, -2.9],
  [-38.5, -3.7], [-37.0, -4.9], [-35.2, -5.5], [-34.8, -7.1], [-35.0, -8.9], [-36.4, -10.5],
  [-37.3, -11.4], [-38.5, -13.0], [-39.0, -15.0], [-39.2, -17.7], [-40.3, -20.3],
  [-41.0, -22.0], [-42.0, -22.97], [-43.2, -23.05], [-44.7, -23.4], [-46.3, -24.0],
  [-48.0, -25.5], [-48.5, -27.0], [-48.6, -28.5], [-49.7, -29.3], [-50.8, -31.0],
  [-52.1, -32.2], [-53.4, -33.7], [-53.5, -32.6], [-55.6, -30.9], [-57.6, -30.2],
  [-55.7, -27.4], [-53.8, -27.1], [-54.6, -25.6], [-54.3, -24.0], [-55.8, -22.3],
  [-57.9, -22.1], [-58.2, -20.1], [-57.6, -18.2], [-58.4, -16.3], [-60.2, -16.3],
  [-60.4, -13.5], [-63.0, -12.6], [-65.3, -10.9], [-65.4, -9.7], [-68.6, -11.0],
  [-70.6, -11.0], [-70.6, -9.5], [-72.4, -10.0], [-73.9, -7.4], [-73.0, -5.1], [-70.0, -4.2],
  [-69.4, -1.0], [-70.1, 0.6], [-69.1, 1.7], [-67.3, 2.1], [-66.8, 1.2], [-64.0, 1.9],
  [-64.8, 4.0], [-63.0, 3.9], [-60.7, 5.2],
]

// Cidades de referência no mapa (latitude, longitude).
// `fim`: o nome fica à esquerda do ponto (cidades perto da borda direita do mapa).
export const CIDADES: { nome: string; lat: number; lon: number; fim?: boolean }[] = [
  { nome: 'São Paulo', lat: -23.55, lon: -46.63 },
  { nome: 'Rio de Janeiro', lat: -22.9, lon: -43.2, fim: true },
  { nome: 'Belo Horizonte', lat: -19.92, lon: -43.94, fim: true },
  { nome: 'Curitiba', lat: -25.43, lon: -49.27 },
  { nome: 'Florianópolis', lat: -27.59, lon: -48.55 },
  { nome: 'Goiânia', lat: -16.68, lon: -49.25 },
  { nome: 'Brasília', lat: -15.79, lon: -47.88 },
  { nome: 'Cuiabá', lat: -15.6, lon: -56.1 },
]
