// Revisión visual: capturas de cada pantalla en móvil y escritorio.
// Requiere `npm run dev` en marcha y Microsoft Edge o Chrome instalado.
//   node scripts/revision-visual.mjs [urlBase]   (por defecto http://localhost:5173/Nakreo/)
import { chromium } from 'playwright-core'
import { mkdirSync } from 'node:fs'

const base = process.argv[2] ?? 'http://localhost:5173/Nakreo/'
const salida = 'capturas'
mkdirSync(salida, { recursive: true })

const movil = { viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true }
const laptop = { viewport: { width: 1280, height: 720 } }
const tv = { viewport: { width: 1920, height: 1080 } }

const pantallas = [
  // [nombre, hash, perfil]
  ['home-movil', '#/', movil],
  ['join-movil', '#/join?room=K7MQP', movil],
  ...[
    ['turno', 'a'], ['rico', 'a'], ['espera', 'b'], ['desafio', 'b'], ['bloqueo', 'b'],
    ['defensa', 'a'], ['perder', 'b'], ['reasignar', 'a'], ['eliminado', 'a'], ['fin', 'a'],
  ].map(([esc, como]) => [`juego-${esc}-movil`, `#/dev?vista=juego&esc=${esc}&como=${como}`, movil]),
  ['lobby-laptop', '#/dev?vista=lobby&n=4', laptop],
  ['lobby-movil', '#/dev?vista=lobby&n=4', movil],
  ['mesa-6-laptop', '#/dev?vista=mesa&esc=avanzada&n=6', laptop],
  ['mesa-6-tv', '#/dev?vista=mesa&esc=avanzada&n=6', tv],
  ['mesa-defensa-laptop', '#/dev?vista=mesa&esc=defensa&n=4', laptop],
  ['mesa-fin-laptop', '#/dev?vista=mesa&esc=fin', laptop],
  ['mesa-movil', '#/dev?vista=mesa&esc=avanzada&n=4', movil],
]

const navegador = await chromium.launch({ channel: 'msedge' })
for (const [nombre, hash, perfil] of pantallas) {
  const ctx = await navegador.newContext(perfil)
  const pagina = await ctx.newPage()
  const errores = []
  pagina.on('pageerror', (e) => errores.push(e.message))
  await pagina.goto(base + hash)
  await pagina.waitForTimeout(600)
  await pagina.screenshot({ path: `${salida}/${nombre}.png`, fullPage: false })
  // Desbordes horizontales: el contenido no debe ser más ancho que la pantalla.
  const desborde = await pagina.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)
  console.log(`${nombre}: ${desborde > 0 ? `DESBORDE +${desborde}px` : 'ok'}${errores.length ? ' ERRORES: ' + errores.join('; ') : ''}`)
  await ctx.close()
}
await navegador.close()
