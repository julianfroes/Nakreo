import { describe, expect, it } from 'vitest'
import readme from '../../README.md?raw'

/**
 * Guarda de nomenclatura: los nombres antiguos de roles y acciones no deben
 * reaparecer en el código, los tests, los scripts ni el README.
 * (Este archivo se excluye a sí mismo porque lista los términos prohibidos.)
 */
const fuentes = import.meta.glob(
  [
    '/src/**/*.ts',
    '/src/**/*.tsx',
    '/scripts/*.mjs',
    '!/src/shared/nomenclatura.test.ts',
  ],
  { query: '?raw', import: 'default', eager: true },
) as Record<string, string>

const PROHIBIDOS: { patron: RegExp; vigente: string }[] = [
  { patron: /director\s*financiero/i, vigente: 'RH' },
  { patron: /saboteador/i, vigente: 'CEO' },
  { patron: /contrabandista/i, vigente: 'Jefe de Área' },
  { patron: /jefe\s*de\s*seguridad|jefeSeguridad/i, vigente: 'Sindicalizado' },
  { patron: /\bsubsidio\b/i, vigente: 'Nómina' },
  { patron: /golpe\s*de\s*mando/i, vigente: 'Demanda laboral' },
  { patron: /\bdividendos\b/i, vigente: 'Malversación / Robo de aguinaldo' },
  { patron: /\bsabotaje\b/i, vigente: 'Despido / Renuncia «voluntaria»' },
  { patron: /\bdesv[ií]o\b/i, vigente: 'Robo de mérito' },
  { patron: /\bIngreso\b/, vigente: 'Sueldo mínimo' },
  // Los iconos de los roles ya no son emojis: viven en `shared/iconos/IconoRol`.
  { patron: /[🧨📦🛡⚙💼]/u, vigente: '<IconoRol />' },
]

describe('nomenclatura vigente', () => {
  it('encuentra los archivos fuente (la guarda no está vacía)', () => {
    expect(Object.keys(fuentes).length).toBeGreaterThan(20)
  })

  for (const { patron, vigente } of PROHIBIDOS) {
    it(`no queda ${patron} (ahora es: ${vigente})`, () => {
      const archivos = Object.entries({ ...fuentes, '/README.md': readme })
        .filter(([, texto]) => patron.test(texto))
        .map(([ruta]) => ruta)
      expect(archivos).toEqual([])
    })
  }
})
