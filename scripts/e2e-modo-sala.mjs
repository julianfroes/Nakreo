// Prueba de extremo a extremo de la sala: modo «sin roles especiales», aforo, «listo» y cambio de modo.
// (WebRTC real, dos navegadores en esta máquina.)
// Requiere `npm run dev` en marcha, internet (señalización de PeerJS) y Edge/Chrome.
//   node scripts/e2e-modo-sala.mjs [urlBase]
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
const interruptor = (p) => p.getByRole('switch', { name: 'Jugar sin roles especiales' })

try {
  // 0. «Crear sala» (la mesa) muestra primero la configuración.
  const mesa = await (await navegador.newContext(escritorio)).newPage()
  await mesa.goto(`${base}#/host`)
  await interruptor(mesa).waitFor({ timeout: 15000 })
  comprobar((await interruptor(mesa).getAttribute('aria-checked')) === 'false', 'la mesa ofrece el interruptor, desactivado por defecto')
  await mesa.screenshot({ path: 'capturas/modo-config-mesa.png' })
  await mesa.close()

  const anfitrion = await (await navegador.newContext(movil)).newPage()
  const invitado = await (await navegador.newContext(movil)).newPage()
  for (const [n, p] of [['anfitrión', anfitrion], ['invitado', invitado]]) {
    p.on('pageerror', (e) => comprobar(false, `error de página (${n}): ${e.message}`))
  }

  // 1. El anfitrión-jugador crea una sala SIN roles especiales.
  await anfitrion.goto(`${base}#/host?jugar=1`)
  await anfitrion.getByPlaceholder('Tu nombre').fill('Ana')
  await interruptor(anfitrion).click()
  comprobar((await interruptor(anfitrion).getAttribute('aria-checked')) === 'true', 'el interruptor se activa')
  await anfitrion.getByText('Hasta 6 jugadores · mazo de 15 cartas').waitFor()
  comprobar(true, 'el formulario muestra el aforo y el mazo del modo elegido')
  await anfitrion.screenshot({ path: 'capturas/modo-config-jugar.png' })
  await anfitrion.getByRole('button', { name: 'Crear sala' }).click()
  const codigo = (await anfitrion.locator('.font-mono').first().innerText({ timeout: 30000 })).trim()
  comprobar(/^[A-Z2-9]{5}$/.test(codigo), `sala creada: ${codigo}`)
  await anfitrion.getByLabel('1 de 6 jugadores').waitFor({ timeout: 10000 })
  comprobar(true, 'el lobby del anfitrión muestra el aforo 1/6')
  comprobar((await anfitrion.getByText(/Sin roles especiales ·/).count()) === 1, 'el lobby muestra el modo «Sin roles especiales»')

  // 2. Un invitado se une y ve el modo y el aforo.
  await invitado.goto(`${base}#/join?room=${codigo}`)
  await invitado.getByPlaceholder('Tu nombre').fill('Beto')
  await invitado.getByRole('button', { name: 'Unirme' }).click()
  await invitado.getByText('Esperando a que el anfitrión inicie').waitFor({ timeout: 40000 })
  await invitado.getByLabel('2 de 6 jugadores').waitFor({ timeout: 10000 })
  comprobar(true, 'el invitado se unió y ve 2/6')
  comprobar((await invitado.getByText(/Sin roles especiales ·/).count()) === 1, 'el invitado ve el modo')
  await invitado.screenshot({ path: 'capturas/modo-lobby-invitado.png' })

  // 3. «Estoy listo» (guía visual): el anfitrión lo ve y no bloquea el inicio.
  await invitado.getByRole('button', { name: 'Estoy listo' }).click()
  await anfitrion.getByText('✓ listo').waitFor({ timeout: 10000 })
  comprobar(true, 'el anfitrión ve «✓ listo» de Beto')
  await invitado.getByRole('button', { name: 'Ya no estoy listo' }).waitFor()
  comprobar((await anfitrion.getByRole('button', { name: 'Iniciar partida' }).isEnabled()), 'el inicio no depende de «listo»')
  await anfitrion.screenshot({ path: 'capturas/modo-lobby-anfitrion.png', fullPage: true })

  // 4. El anfitrión cambia el modo en la sala de espera: todos lo ven y se borran los «listo».
  await interruptor(anfitrion).click()
  await anfitrion.getByLabel('2 de 8 jugadores').waitFor({ timeout: 10000 })
  await invitado.getByLabel('2 de 8 jugadores').waitFor({ timeout: 10000 })
  comprobar((await invitado.getByText(/Con roles especiales ·/).count()) === 1, 'el invitado ve el cambio a «Con roles especiales» (8)')
  comprobar((await anfitrion.getByText('✓ listo').count()) === 0, 'al cambiar el modo se borran los «listo»')

  // 5. Vuelta al modo sin especiales e inicio: no hay acciones especiales.
  await interruptor(anfitrion).click()
  await anfitrion.getByLabel('2 de 6 jugadores').waitFor({ timeout: 10000 })
  await anfitrion.getByRole('button', { name: 'Iniciar partida' }).click()
  await anfitrion.getByText('Tus cartas (solo tú las ves)', { exact: true }).waitFor({ timeout: 15000 })
  await invitado.getByText('Tus cartas (solo tú las ves)', { exact: true }).waitFor({ timeout: 15000 })
  comprobar(true, 'la partida empieza en el modo sin especiales')
  const turnoAnfitrion = (await anfitrion.getByText('¡Tu turno!').count()) > 0
  const activo = turnoAnfitrion ? anfitrion : invitado
  await activo.getByRole('button', { name: /Sueldo mínimo/ }).waitFor()
  const especiales = await activo.getByRole('button', { name: /Robo de aguinaldo|Renuncia/ }).count()
  comprobar(especiales === 0, 'no hay acciones especiales para elegir')
  comprobar((await activo.getByRole('button', { name: /Demanda laboral|Despido|Nómina|Malversación|Robo de mérito|Reasignación/ }).count()) === 6,
    'las 6 acciones restantes siguen disponibles')
  await activo.screenshot({ path: 'capturas/modo-partida-sin-especiales.png', fullPage: true })
} catch (e) {
  comprobar(false, `excepción: ${e.message}`)
} finally {
  await navegador.close()
}
console.log(fallos.length ? `\n${fallos.length} fallo(s)` : '\nTodo correcto')
process.exit(fallos.length ? 1 : 0)
