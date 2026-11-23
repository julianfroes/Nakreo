// Prueba de extremo a extremo de Reglas, Guía rápida y Descarte (navegadores reales, WebRTC real).
//  - Reglas en la pantalla principal y en la sala de espera (host y jugador).
//  - Descarte: se actualiza en tiempo real con una carta que se pierde.
//  - Guía rápida: no altera la partida y se cierra sola ante una decisión urgente.
//  - Accesibilidad del panel: Esc, toque fuera, foco, scroll del fondo.
// Las manos/cartas se fuerzan con `window.nakreo` (solo existe en desarrollo).
// Requiere `npm run dev` en marcha, internet (señalización de PeerJS) y Edge/Chrome.
//   node scripts/e2e-descarte-guia.mjs [urlBase]
import { chromium } from 'playwright-core'
import { mkdirSync } from 'node:fs'

const base = process.argv[2] ?? 'http://localhost:5173/Nakreo/'
mkdirSync('capturas', { recursive: true })
const movil = { viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true }

const navegador = await chromium.launch({ channel: 'msedge' })
const paginas = {}
const fallos = []
const comprobar = (ok, texto) => {
  console.log(`${ok ? 'OK  ' : 'FALLO'} ${texto}`)
  if (!ok) fallos.push(texto)
}
const boton = (p, nombre) => p.getByRole('button', { name: nombre })
const dialogo = (p, nombre) => p.getByRole('dialog', { name: nombre })
const encabezadoMano = (p) => p.getByText('Tus cartas (solo tú las ves)', { exact: true })
const focoEn = (p) => p.evaluate(() => document.activeElement?.textContent?.trim() ?? '')
const bloqueoScroll = (p) => p.evaluate(() => document.body.style.overflow)

try {
  const inicio = await (await navegador.newContext(movil)).newPage()
  const ana = await (await navegador.newContext(movil)).newPage()
  const beto = await (await navegador.newContext(movil)).newPage()
  Object.assign(paginas, { Inicio: inicio, Ana: ana, Beto: beto })
  for (const [n, p] of Object.entries(paginas)) p.on('pageerror', (e) => comprobar(false, `error de página (${n}): ${e.message}`))

  // ------------------------------------------------ 1. Reglas en la pantalla principal
  await inicio.goto(`${base}#/`)
  await boton(inicio, /Reglas/).click()
  const reglas = dialogo(inicio, 'Reglas')
  await reglas.waitFor()
  comprobar(true, 'la pantalla principal tiene «Reglas» y abre un panel')
  comprobar((await bloqueoScroll(inicio)) === 'hidden', 'con el panel abierto el fondo no se desplaza')
  comprobar((await reglas.getByRole('tab').count()) === 3, 'el reglamento tiene pestañas Reglas, Acciones y Roles')
  comprobar((await reglas.getByText('Salir de la partida').count()) >= 1, 'incluye las reglas de salir de la partida')

  await reglas.getByRole('tab', { name: 'Acciones' }).click()
  comprobar((await reglas.getByRole('tabpanel').getByRole('listitem').count()) === 9, 'con roles especiales hay 9 acciones')
  await boton(reglas, 'Sin roles especiales').click()
  comprobar((await reglas.getByRole('tabpanel').getByRole('listitem').count()) === 7, 'sin roles especiales hay 7 acciones')
  await reglas.getByRole('tab', { name: 'Roles' }).click()
  comprobar((await reglas.getByText('Carta especial').count()) === 0, 'sin roles especiales no hay cartas especiales')
  await boton(reglas, 'Con roles especiales').click()
  comprobar((await reglas.getByText('Carta especial').count()) === 5, 'con roles especiales hay 5 cartas especiales')

  // Teclado: Tab no se sale del panel.
  for (let k = 0; k < 14; k++) await inicio.keyboard.press('Tab')
  comprobar(await inicio.evaluate(() => document.querySelector('[role=dialog]')?.contains(document.activeElement) ?? false), 'el foco con Tab no sale del panel')
  await inicio.screenshot({ path: 'capturas/reglas-pantalla-principal-movil.png' })

  await inicio.keyboard.press('Escape')
  await reglas.waitFor({ state: 'detached' })
  comprobar((await focoEn(inicio)).includes('Reglas'), 'Esc cierra el panel y el foco vuelve al botón «Reglas»')
  comprobar((await bloqueoScroll(inicio)) !== 'hidden', 'al cerrar, el fondo vuelve a desplazarse')

  await boton(inicio, /Reglas/).click()
  await reglas.waitFor()
  await inicio.mouse.click(190, 20) // un toque fuera del panel
  await reglas.waitFor({ state: 'detached' })
  comprobar(true, 'un toque fuera cierra el panel')
  await boton(inicio, /Reglas/).click()
  await dialogo(inicio, 'Reglas').getByRole('button', { name: 'Cerrar', exact: true }).click()
  await reglas.waitFor({ state: 'detached' })
  comprobar(true, 'el botón grande «Cerrar» cierra el panel')

  // ------------------------------------------- 2. Reglas en la sala de espera (host y jugador)
  await ana.goto(`${base}#/host?jugar=1`)
  await ana.getByPlaceholder('Tu nombre').fill('Ana')
  await ana.getByRole('button', { name: 'Crear sala' }).click()
  const codigo = (await ana.locator('.font-mono').first().innerText({ timeout: 30000 })).trim()
  await beto.goto(`${base}#/join?room=${codigo}`)
  await beto.getByPlaceholder('Tu nombre').fill('Beto')
  await beto.getByRole('button', { name: 'Unirme' }).click()
  await beto.getByText('Esperando a que el anfitrión inicie').waitFor({ timeout: 40000 })
  await ana.getByLabel('2 de 8 jugadores').waitFor({ timeout: 10000 })

  await boton(ana, /Reglas/).click()
  await dialogo(ana, 'Reglas').getByText('Modo de esta sala: Con roles especiales').waitFor()
  comprobar(true, 'las Reglas de la sala de espera del anfitrión muestran el modo de la sala')
  await ana.keyboard.press('Escape')
  await ana.getByRole('switch', { name: 'Jugar sin roles especiales' }).click() // la sala pasa a modo base
  await beto.getByText(/Sin roles especiales ·/).waitFor({ timeout: 10000 })
  await boton(beto, /Reglas/).click()
  await dialogo(beto, 'Reglas').getByText('Modo de esta sala: Sin roles especiales').waitFor()
  comprobar(true, 'las Reglas del jugador reflejan el modo vigente de la sala')
  await beto.keyboard.press('Escape')
  await ana.getByRole('switch', { name: 'Jugar sin roles especiales' }).click() // de vuelta a roles especiales
  await ana.getByLabel('2 de 8 jugadores').waitFor({ timeout: 10000 })

  // ---------------------------------------------------------------- 3. En partida
  await ana.getByRole('button', { name: 'Iniciar partida' }).click()
  await encabezadoMano(ana).waitFor({ timeout: 15000 })
  await encabezadoMano(beto).waitFor({ timeout: 15000 })
  comprobar((await boton(ana, /^Descarte \(0\)/).count()) === 1 && (await boton(beto, /^Descarte \(0\)/).count()) === 1, 'ambos ven «Descarte (0)» y «Guía rápida» en la zona secundaria')
  comprobar((await boton(beto, /Guía rápida/).count()) === 1, 'el botón «Guía rápida» está disponible durante la partida')

  // Descarte en tiempo real: Beto pierde una carta (forzado) con el descarte plegado.
  await ana.evaluate(() => {
    const h = window.nakreo
    h.estado.jugadores[1].cartas[0].revelada = true
    h.difundirEstado([])
    h.notificar()
  })
  await boton(ana, /^Descarte \(1\)/).waitFor({ timeout: 10000 })
  await boton(beto, /^Descarte \(1\)/).waitFor({ timeout: 10000 })
  comprobar(true, 'el contador del descarte se actualiza en tiempo real en todos, aun plegado')
  const descarte = boton(ana, /^Descarte/)
  comprobar((await descarte.getAttribute('aria-expanded')) === 'false', 'empieza plegado (aria-expanded=false)')
  await descarte.click()
  const region = ana.getByRole('region', { name: 'Descarte' })
  await region.waitFor()
  comprobar((await descarte.getAttribute('aria-expanded')) === 'true', 'al abrirlo, aria-expanded=true')
  comprobar((await region.innerText()).includes('Beto'), 'el descarte agrupa la carta por jugador (Beto)')
  await ana.screenshot({ path: 'capturas/descarte-abierto-movil.png', fullPage: true })

  // Guía rápida: abre, no altera la partida y el descarte sigue actualizándose por detrás.
  await boton(ana, /Guía rápida/).click()
  const guia = dialogo(ana, 'Guía rápida')
  await guia.waitFor()
  comprobar((await guia.getByRole('tabpanel').getByRole('listitem').count()) === 9, 'la guía lista las 9 acciones del modo')
  comprobar((await guia.getByText('Quien la recibe, con Sindicalizado', { exact: true }).count()) >= 1, 'dice con claridad quién puede bloquear el Despido')
  await ana.screenshot({ path: 'capturas/guia-en-partida-movil.png' })
  await ana.evaluate(() => {
    const h = window.nakreo
    h.estado.jugadores[1].cartas[1].revelada = true
    h.estado.jugadores[1].eliminado = true
    h.difundirEstado([])
    h.notificar()
  })
  await ana.keyboard.press('Escape')
  await guia.waitFor({ state: 'detached' })
  comprobar((await focoEn(ana)).includes('Guía rápida'), 'al cerrar la guía el foco vuelve a su botón')
  await boton(ana, /^Descarte \(2\)/).waitFor({ timeout: 5000 })
  comprobar(true, 'mientras la guía estaba abierta la partida siguió actualizándose')
  comprobar((await ana.getByText('¡Tu turno!').count()) === 1, 'la partida no se alteró: sigue siendo el turno de Ana')

  // La guía se cierra sola ante una decisión urgente.
  await ana.evaluate(() => {
    const h = window.nakreo
    const e = h.estado
    e.jugadores[1].cartas.forEach((c) => (c.revelada = false))
    e.jugadores[1].eliminado = false
    e.jugadorActivo = e.jugadores[1].id // Beto tiene el turno
    e.fase = { tipo: 'accion' }
    h.difundirEstado([])
    h.notificar()
  })
  await beto.getByText('¡Tu turno!').waitFor({ timeout: 10000 })
  await boton(beto, /Malversación/).click() // Beto reclama ser RH
  await beto.getByText(/Esperando a Ana/).waitFor({ timeout: 10000 })
  await boton(beto, /Guía rápida/).click()
  await dialogo(beto, 'Guía rápida').waitFor()
  await boton(ana, 'Desafiar (¿miente?)').click() // Ana lo desafía: Beto debe responder ya
  await beto.getByRole('heading', { name: /te desafía/ }).waitFor({ timeout: 10000 })
  comprobar((await dialogo(beto, 'Guía rápida').count()) === 0, 'ante una decisión urgente la guía se cierra sola y no tapa la defensa')
  await beto.screenshot({ path: 'capturas/guia-cierra-ante-desafio-movil.png' })
} catch (e) {
  comprobar(false, `excepción: ${e.message}`)
  for (const [n, p] of Object.entries(paginas)) {
    const texto = await p.locator('body').innerText().catch(() => '(sin acceso)')
    console.log(`--- pantalla de ${n} ---`)
    console.log(texto.split(/\s*\n+\s*/).join(' | ').slice(0, 500))
  }
} finally {
  await navegador.close()
}
console.log(fallos.length ? `\n${fallos.length} fallo(s)` : '\nTodo correcto')
process.exit(fallos.length ? 1 : 0)
