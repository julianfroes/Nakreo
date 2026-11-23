// Prueba de extremo a extremo: el anfitrión de una MESA se une como jugador desde la sala de espera,
// deja su asiento, vuelve a sentarse e inicia la partida. (WebRTC real, dos navegadores.)
// Requiere `npm run dev` en marcha, internet (señalización de PeerJS) y Edge/Chrome.
//   node scripts/e2e-host-se-une.mjs [urlBase]
import { chromium } from 'playwright-core'
import { mkdirSync } from 'node:fs'

const base = process.argv[2] ?? 'http://localhost:5173/Nakreo/'
mkdirSync('capturas', { recursive: true })
const movil = { viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true }
const escritorio = { viewport: { width: 1280, height: 800 } }

const navegador = await chromium.launch({ channel: 'msedge' })
const fallos = []
const comprobar = (ok, texto) => {
  console.log(`${ok ? 'OK  ' : 'FALLO'} ${texto}`)
  if (!ok) fallos.push(texto)
}
const botonUnirme = (p) => p.getByRole('button', { name: 'Unirme a esta sala como jugador' })
const botonDejar = (p) => p.getByRole('button', { name: /Dejar mi asiento/ })
const encabezadoMano = (p) => p.getByText('Tus cartas (solo tú las ves)', { exact: true })

try {
  const anfitrion = await (await navegador.newContext(escritorio)).newPage()
  const invitado = await (await navegador.newContext(movil)).newPage()
  for (const [n, p] of [['anfitrión', anfitrion], ['invitado', invitado]]) {
    p.on('pageerror', (e) => comprobar(false, `error de página (${n}): ${e.message}`))
  }

  // 1. El anfitrión crea una MESA (no juega) y entra un invitado.
  await anfitrion.goto(`${base}#/host`)
  await anfitrion.getByRole('button', { name: 'Crear sala' }).click()
  const codigo = (await anfitrion.locator('.font-mono').first().innerText({ timeout: 30000 })).trim()
  comprobar(/^[A-Z2-9]{5}$/.test(codigo), `mesa creada: ${codigo}`)
  await invitado.goto(`${base}#/join?room=${codigo}`)
  await invitado.getByPlaceholder('Tu nombre').fill('Beto')
  await invitado.getByRole('button', { name: 'Unirme' }).click()
  await invitado.getByText('Esperando a que el anfitrión inicie').waitFor({ timeout: 40000 })
  await anfitrion.getByLabel('1 de 8 jugadores').waitFor({ timeout: 10000 })
  comprobar((await botonUnirme(anfitrion).isEnabled()), 'hay lugar: el botón «Unirme a esta sala como jugador» está disponible')
  comprobar((await botonDejar(anfitrion).count()) === 0, 'sin asiento no se ofrece «Dejar mi asiento»')

  // 2. El anfitrión se une como jugador.
  await botonUnirme(anfitrion).click()
  await anfitrion.getByPlaceholder('Tu nombre').fill('Ana')
  await anfitrion.screenshot({ path: 'capturas/host-se-une-formulario.png', fullPage: true })
  await anfitrion.getByRole('button', { name: 'Unirme', exact: true }).click()
  await botonDejar(anfitrion).waitFor({ timeout: 15000 })
  await anfitrion.getByLabel('2 de 8 jugadores').waitFor({ timeout: 10000 })
  comprobar((await anfitrion.getByText('(tú)').count()) === 1, 'el anfitrión aparece como «Ana (tú)» y ve «Dejar mi asiento»')
  await invitado.getByLabel('2 de 8 jugadores').waitFor({ timeout: 10000 })
  comprobar((await invitado.getByText('Ana').count()) >= 1, 'el invitado ve a Ana en la sala')
  comprobar((await botonUnirme(anfitrion).count()) === 0, 'ya no se ofrece unirse de nuevo (un solo asiento)')
  await anfitrion.screenshot({ path: 'capturas/host-se-une-sentado.png', fullPage: true })

  // 3. Deja el asiento: vuelve a ser solo la mesa y el invitado deja de verlo.
  await botonDejar(anfitrion).click()
  await botonUnirme(anfitrion).waitFor({ timeout: 10000 })
  await invitado.getByLabel('1 de 8 jugadores').waitFor({ timeout: 10000 })
  comprobar((await invitado.getByText('Ana').count()) === 0, 'al dejar el asiento, Ana desaparece de la sala del invitado')

  // 4. Vuelve a sentarse e inicia: su pantalla es la de jugador, sin la mesa general.
  await botonUnirme(anfitrion).click()
  await anfitrion.getByPlaceholder('Tu nombre').fill('Ana')
  await anfitrion.getByRole('button', { name: 'Unirme', exact: true }).click()
  await botonDejar(anfitrion).waitFor({ timeout: 15000 })
  await anfitrion.getByRole('button', { name: 'Iniciar partida' }).click()
  await encabezadoMano(anfitrion).waitFor({ timeout: 15000 })
  await encabezadoMano(invitado).waitFor({ timeout: 15000 })
  comprobar(true, 'la partida empieza y ambos ven sus cartas privadas')
  // «Cartas reveladas» solo existe en la mesa general (el registro lateral del jugador de ordenador no cuenta).
  comprobar((await anfitrion.getByText(/Cartas reveladas \(/).count()) === 0, 'el anfitrión sentado no ve la mesa general (su mano no queda a la vista)')

  // 5. Se puede jugar.
  const turnoAnfitrion = (await anfitrion.getByText('¡Tu turno!').count()) > 0
  const [activo, otro] = turnoAnfitrion ? [anfitrion, invitado] : [invitado, anfitrion]
  await activo.getByRole('button', { name: /Sueldo mínimo/ }).click()
  await otro.getByText('¡Tu turno!').waitFor({ timeout: 15000 })
  comprobar(true, 'el turno pasó al otro jugador')
} catch (e) {
  comprobar(false, `excepción: ${e.message}`)
} finally {
  await navegador.close()
}
console.log(fallos.length ? `\n${fallos.length} fallo(s)` : '\nTodo correcto')
process.exit(fallos.length ? 1 : 0)
