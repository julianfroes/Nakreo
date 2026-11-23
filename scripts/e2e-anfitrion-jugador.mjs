// Prueba de extremo a extremo (WebRTC real, dos navegadores en esta máquina):
// el anfitrión crea la sala y juega, otro jugador se une y empiezan.
// Requiere `npm run dev` en marcha, internet (señalización de PeerJS) y Edge/Chrome.
//   node scripts/e2e-anfitrion-jugador.mjs [urlBase]
import { chromium } from 'playwright-core'
import { mkdirSync } from 'node:fs'

const base = process.argv[2] ?? 'http://localhost:5173/Nakreo/'
mkdirSync('capturas', { recursive: true })
const movil = { viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true }

const navegador = await chromium.launch({ channel: 'msedge' })
const fallos = []
const comprobar = (ok, texto) => {
  console.log(`${ok ? 'OK  ' : 'FALLO'} ${texto}`)
  if (!ok) fallos.push(texto)
}

try {
  const anfitrion = await (await navegador.newContext(movil)).newPage()
  const invitado = await (await navegador.newContext(movil)).newPage()
  for (const [n, p] of [['anfitrión', anfitrion], ['invitado', invitado]]) {
    p.on('pageerror', (e) => comprobar(false, `error de página (${n}): ${e.message}`))
  }

  // 1. El anfitrión crea la sala y entra como jugador.
  await anfitrion.goto(`${base}#/host?jugar=1`)
  await anfitrion.getByPlaceholder('Tu nombre').fill('Ana')
  await anfitrion.getByRole('button', { name: 'Crear sala' }).click()
  const codigo = (await anfitrion.locator('.font-mono').first().innerText({ timeout: 30000 })).trim()
  comprobar(/^[A-Z2-9]{5}$/.test(codigo), `sala creada: ${codigo}`)
  await anfitrion.getByText('Ana').first().waitFor({ timeout: 10000 })
  comprobar(true, 'el anfitrión aparece como jugador en su propio lobby')

  // 2. Un segundo navegador se une por WebRTC.
  await invitado.goto(`${base}#/join?room=${codigo}`)
  await invitado.getByPlaceholder('Tu nombre').fill('Beto')
  await invitado.getByRole('button', { name: 'Unirme' }).click()
  await invitado.getByText('Esperando a que el anfitrión inicie').waitFor({ timeout: 40000 })
  comprobar(true, 'el invitado se unió por WebRTC')

  // 3. El anfitrión inicia; ambos ven su mano privada.
  const iniciar = anfitrion.getByRole('button', { name: 'Iniciar partida' })
  await iniciar.waitFor()
  await anfitrion.waitForFunction(() => !document.querySelector('button:disabled')?.textContent?.includes('Iniciar'), null, { timeout: 15000 })
  await iniciar.click()
  // Texto exacto: «Tus cartas» como subcadena también aparece en la descripción de la carta
  // Ingeniero («Cambia tus cartas con el mazo…»), y depende del reparto aleatorio.
  const encabezadoMano = (p) => p.getByText('Tus cartas (solo tú las ves)', { exact: true })
  await encabezadoMano(anfitrion).waitFor({ timeout: 15000 })
  await encabezadoMano(invitado).waitFor({ timeout: 15000 })
  comprobar(true, 'ambos ven sus cartas')
  await anfitrion.waitForTimeout(500)
  await anfitrion.screenshot({ path: 'capturas/e2e-anfitrion-jugando.png' })
  await invitado.screenshot({ path: 'capturas/e2e-invitado-jugando.png' })

  // 4. El anfitrión NO ve la mesa general (nada del panel de la mesa).
  // «Cartas reveladas» solo existe en la mesa general (el registro lateral del jugador de ordenador no cuenta).
  comprobar((await anfitrion.getByText(/Cartas reveladas \(/).count()) === 0, 'el anfitrión-jugador no ve la mesa general')

  // 5. Quien tenga el turno juega Sueldo mínimo y el otro lo ve.
  const turnoAnfitrion = await anfitrion.getByText('¡Tu turno!').count()
  const [activo, otro] = turnoAnfitrion ? [anfitrion, invitado] : [invitado, anfitrion]
  await activo.getByRole('button', { name: /Sueldo mínimo/ }).click()
  await otro.getByText('¡Tu turno!').waitFor({ timeout: 15000 })
  comprobar(true, 'el turno pasó al otro jugador tras un Sueldo mínimo')
} catch (e) {
  comprobar(false, `excepción: ${e.message}`)
} finally {
  await navegador.close()
}
console.log(fallos.length ? `\n${fallos.length} fallo(s)` : '\nTodo correcto')
process.exit(fallos.length ? 1 : 0)
