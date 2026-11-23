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
const tablet = { viewport: { width: 768, height: 1024 }, deviceScaleFactor: 1, isMobile: true, hasTouch: true }
const portatil = { viewport: { width: 1024, height: 768 } }

const pantallas = [
  // [nombre, hash, perfil]
  ['home-movil', '#/', movil],
  ['join-movil', '#/join?room=K7MQP', movil],
  ...[
    ['turno', 'a'], ['rico', 'a'], ['espera', 'b'], ['desafio', 'b'], ['bloqueo', 'b'],
    ['defensa', 'a'], ['perder', 'b'], ['reasignar', 'a'], ['eliminado', 'a'], ['fin', 'a'],
  ].map(([esc, como]) => [`juego-${esc}-movil`, `#/dev?vista=juego&esc=${esc}&como=${como}`, movil]),
  ['juego-retirado-movil', '#/dev?vista=juego&esc=retirado&como=b&n=3', movil],
  ['mesa-retirado-laptop', '#/dev?vista=mesa&esc=retirado&n=4', laptop],
  ['juego-ataque-movil', '#/dev?vista=juego&esc=ataque&como=b&n=3', movil],
  // Pantalla del jugador en ordenador y tableta (dos paneles a partir de 1024 px).
  ['juego-turno-laptop', '#/dev?vista=juego&esc=turno&como=a&n=5', laptop],
  ['juego-turno-portatil', '#/dev?vista=juego&esc=turno&como=a&n=6', portatil],
  ['juego-turno-tablet', '#/dev?vista=juego&esc=turno&como=a&n=4', tablet],
  ['juego-ataque-laptop', '#/dev?vista=juego&esc=ataque&como=b&n=4', laptop],
  ['juego-bloqueo-laptop', '#/dev?vista=juego&esc=bloqueo&como=b&n=4', laptop],
  ['juego-defensa-laptop', '#/dev?vista=juego&esc=defensa&como=a&n=4', laptop],
  ['juego-reasignar-laptop', '#/dev?vista=juego&esc=reasignar&como=a&n=4', laptop],
  ['juego-perder-laptop', '#/dev?vista=juego&esc=perder&como=b&n=4', laptop],
  ['panel-guia-acciones-movil', '#/dev?vista=panel&modo=guia&pestana=acciones', movil],
  ['panel-guia-roles-movil', '#/dev?vista=panel&modo=guia&pestana=roles', movil],
  ['panel-guia-sin-especiales-movil', '#/dev?vista=panel&modo=guia&sin=1&pestana=roles', movil],
  ['panel-reglas-movil', '#/dev?vista=panel&modo=reglas&libre=1', movil],
  ['panel-reglas-laptop', '#/dev?vista=panel&modo=reglas&libre=1', laptop],
  ['descarte-movil', '#/dev?vista=descarte&esc=avanzada&como=a&n=4', movil],
  ['iconos-roles', '#/dev?vista=iconos', laptop],
  ['host-jugador-form-movil', '#/host?jugar=1', movil],
  ['juego-fin-anfitrion-movil', '#/dev?vista=juego&esc=fin&como=a&anfitrion=1', movil],
  ['juego-turno-anfitrion-movil', '#/dev?vista=juego&esc=espera&como=b&anfitrion=1', movil],
  ['lobby-laptop', '#/dev?vista=lobby&n=4', laptop],
  ['lobby-movil', '#/dev?vista=lobby&n=4', movil],
  ['lobby-sala-llena-movil', '#/dev?vista=lobby&n=6&sin=1', movil],
  ['lobby-anfitrion-sentado-movil', '#/dev?vista=lobby&n=4&yo=1', movil],
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
