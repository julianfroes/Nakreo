import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { GALERIA_CARTAS_VISIBLE } from '../galeriaCartas'
import { ContenidoGaleria } from './GaleriaCartas'

describe('galería de cartas', () => {
  it('está oculta por defecto (sin botones que la abran)', () => {
    expect(GALERIA_CARTAS_VISIBLE).toBe(false)
  })

  it('muestra las 15 cartas normales, con icono de respaldo mientras no haya arte', () => {
    const s = renderToStaticMarkup(<ContenidoGaleria />)
    expect(s.match(/<li/g)).toHaveLength(15)
    expect(s).toContain('Normales')
    expect(s).toContain('Especiales')
    expect(s).toContain('<svg')
  })
})
