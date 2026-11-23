import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { ROLES, TODOS_LOS_ROLES } from '../../game/roles'
import { EtiquetaRol, IconoRol } from './IconoRol'

const html = (el: React.ReactElement) => renderToStaticMarkup(el)

/** El dibujo interior del <svg>, sin los atributos del contenedor. */
const dibujo = (rol: (typeof TODOS_LOS_ROLES)[number]) =>
  html(<IconoRol rol={rol} decorativo />).replace(/^<svg[^>]*>/, '').replace(/<\/svg>$/, '')

describe('IconoRol', () => {
  it('hay un icono distinto para cada uno de los 5 roles', () => {
    const dibujos = TODOS_LOS_ROLES.map(dibujo)
    expect(new Set(dibujos).size).toBe(5)
    for (const d of dibujos) expect(d.length).toBeGreaterThan(40)
  })

  it('como imagen se anuncia con el nombre del rol (aria-label)', () => {
    for (const rol of TODOS_LOS_ROLES) {
      const s = html(<IconoRol rol={rol} />)
      expect(s).toContain('role="img"')
      expect(s).toContain(`aria-label="${ROLES[rol].nombre}"`)
      expect(s).not.toContain('aria-hidden')
    }
  })

  it('una carta especial se anuncia como «… Especial» y lleva la insignia dorada', () => {
    const s = html(<IconoRol rol="ceo" especial />)
    expect(s).toContain('aria-label="CEO Especial"')
    expect(s).toContain('text-yellow-300')
    expect(html(<IconoRol rol="ceo" />)).not.toContain('text-yellow-300')
  })

  it('decorativo: oculto a los lectores de pantalla y sin nombre duplicado', () => {
    const s = html(<IconoRol rol="rh" decorativo />)
    expect(s).toContain('aria-hidden="true"')
    expect(s).not.toContain('aria-label')
    expect(s).not.toContain('role=')
  })

  it('tamaño: 32 px por defecto, el que se indique, o «auto» para llenar el contenedor', () => {
    expect(html(<IconoRol rol="ingeniero" />)).toContain('width="32"')
    expect(html(<IconoRol rol="ingeniero" tamano={48} />)).toContain('width="48"')
    const auto = html(<IconoRol rol="ingeniero" tamano="auto" />)
    expect(auto).not.toMatch(/\swidth=/) // (stroke-width sí existe)
    expect(auto).toContain('size-full')
  })

  it('cada rol tiene su color', () => {
    const color = (rol: (typeof TODOS_LOS_ROLES)[number]) => html(<IconoRol rol={rol} />).match(/text-(\w+)-300/)?.[1]
    expect(new Set(TODOS_LOS_ROLES.map(color)).size).toBe(5)
    expect(html(<IconoRol rol="rh" especial />)).toContain('text-yellow-300')
  })

  it('mismo trazo en todo el set (cuadrícula 24×24, trazo 1,75, extremos redondeados)', () => {
    for (const rol of TODOS_LOS_ROLES) {
      const s = html(<IconoRol rol={rol} />)
      expect(s).toContain('viewBox="0 0 24 24"')
      expect(s).toContain('stroke-width="1.75"')
      expect(s).toContain('stroke-linecap="round"')
      expect(s).toContain('stroke-linejoin="round"')
    }
  })

  it('el engranaje es un perfil cerrado de 8 dientes, generado sin depender de iconos ajenos', () => {
    const d = html(<IconoRol rol="ingeniero" />).match(/<path d="([^"]+)"/)![1]
    expect(d.startsWith('M')).toBe(true)
    expect(d.endsWith('Z')).toBe(true)
    expect((d.match(/L/g) ?? []).length).toBe(8 * 3) // 3 tramos rectos por diente
    expect((d.match(/A/g) ?? []).length).toBe(8) // un arco de valle entre cada diente
    expect(d).not.toContain('NaN')
  })
})

describe('EtiquetaRol', () => {
  it('muestra icono decorativo y el nombre una sola vez', () => {
    const s = html(<EtiquetaRol rol="sindicalizado" especial />)
    expect(s).toContain('Sindicalizado Especial')
    expect(s).toContain('aria-hidden="true"')
    expect(s.match(/Sindicalizado Especial/g)).toHaveLength(1)
  })
})
