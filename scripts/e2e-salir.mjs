// Prueba de extremo a extremo de «salir de la partida»: tres navegadores con WebRTC real.
//  - Un jugador sale (con confirmación), pierde sus vidas, el turno sigue sin él y no puede volver a entrar.
//  - El anfitrión sale: aviso claro y la sala se cierra para todos al instante.
// Requiere `npm run dev` en marcha, internet (señalización de PeerJS) y Edge/Chrome.
//   node scripts/e2e-salir.mjs [urlBase]
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
const encabezadoMano = (p) => p.getByText('Tus cartas (solo tú las ves)', { exact: true })
const botonSalir = (p) => p.getByRole('button', { name: /Salir de la partida…/ })

try {
  const ana = await (await navegador.newContext(movil)).newPage()
  const beto = await (await navegador.newContext(movil)).newPage()
  const carla = await (await navegador.newContext(movil)).newPage()
  for (const [n, p] of [['Ana', ana], ['Beto', beto], ['Carla', carla]]) {
    paginas[n] = p
    p.on('pageerror', (e) => comprobar(false, `error de página (${n}): ${e.message}`))
  }

  // 1. Ana (anfitriona-jugadora) crea la sala; entran Beto y Carla; empieza la partida.
  await ana.goto(`${base}#/host?jugar=1`)
  await ana.getByPlaceholder('Tu nombre').fill('Ana')
  await ana.getByRole('button', { name: 'Crear sala' }).click()
  const codigo = (await ana.locator('.font-mono').first().innerText({ timeout: 30000 })).trim()
  comprobar(/^[A-Z2-9]{5}$/.test(codigo), `sala creada: ${codigo}`)
  for (const [nombre, p] of [['Beto', beto], ['Carla', carla]]) {
    await p.goto(`${base}#/join?room=${codigo}`)
    await p.getByPlaceholder('Tu nombre').fill(nombre)
    await p.getByRole('button', { name: 'Unirme' }).click()
    await p.getByText('Esperando a que el anfitrión inicie').waitFor({ timeout: 40000 })
  }
  await ana.getByLabel('3 de 8 jugadores').waitFor({ timeout: 10000 })

  // 1b. En la sala de espera, salir libera el asiento (sin fantasmas «desconectado»).
  await carla.getByRole('button', { name: 'Salir', exact: true }).click()
  await ana.getByLabel('2 de 8 jugadores').waitFor({ timeout: 10000 })
  comprobar((await ana.getByText('desconectado').count()) === 0, 'salir en la sala de espera libera el asiento (no queda «desconectado»)')
  await carla.getByRole('button', { name: 'Unirme' }).waitFor({ timeout: 10000 })
  comprobar(true, 'Carla vuelve al formulario de unirse')
  await carla.getByPlaceholder('Tu nombre').fill('Carla')
  await carla.getByRole('button', { name: 'Unirme' }).click()
  await carla.getByText('Esperando a que el anfitrión inicie').waitFor({ timeout: 40000 })
  await ana.getByLabel('3 de 8 jugadores').waitFor({ timeout: 10000 })
  comprobar(true, 'Carla vuelve a entrar sin problema (no era una partida en curso)')

  await ana.getByRole('button', { name: 'Iniciar partida' }).click()
  for (const p of [ana, beto, carla]) await encabezadoMano(p).waitFor({ timeout: 15000 })
  comprobar(true, 'la partida empieza con los tres')

  // 2. Beto sale: confirmación explícita con el aviso.
  comprobar((await botonSalir(beto).count()) === 1, 'Beto ve «Salir de la partida…» fuera de sus acciones')
  await botonSalir(beto).click()
  const dialogo = beto.getByRole('alertdialog')
  await dialogo.waitFor()
  const texto = (await dialogo.innerText()).replace(/\s+/g, ' ')
  comprobar(
    texto.includes('Si sales no podrás reingresar a esta partida. Perderás tus vidas y, si tenías una acción pendiente, el turno continuará.'),
    'el aviso de confirmación dice lo acordado',
  )
  await beto.screenshot({ path: 'capturas/salir-confirmacion-movil.png', fullPage: true })
  await beto.getByRole('button', { name: 'Quedarme' }).click()
  comprobar((await beto.getByRole('alertdialog').count()) === 0, '«Quedarme» cancela y sigue en la partida')

  await botonSalir(beto).click()
  await beto.getByRole('button', { name: 'Sí, salir de la partida' }).click()
  await beto.getByText('Abandonaste la partida').waitFor({ timeout: 15000 })
  comprobar(true, 'Beto ve la pantalla «Abandonaste la partida»')
  await beto.screenshot({ path: 'capturas/salir-despedida-movil.png' })

  // 3. Los demás lo ven como retirado y la partida continúa saltándolo.
  await ana.locator('header').getByText('Retirado', { exact: true }).waitFor({ timeout: 15000 })
  await carla.locator('header').getByText('Retirado', { exact: true }).waitFor({ timeout: 15000 })
  comprobar(true, 'Ana y Carla ven a Beto como «Retirado»')
  await ana.getByRole('button', { name: /Sueldo mínimo/ }).click() // Ana tenía el turno
  await carla.getByText('¡Tu turno!').waitFor({ timeout: 15000 })
  comprobar(true, 'tras Ana juega Carla: el turno salta al retirado')

  // 4. Beto no puede volver a entrar a esta partida.
  await beto.getByRole('button', { name: 'Volver al inicio' }).click()
  await beto.goto(`${base}#/join?room=${codigo}`)
  await beto.getByPlaceholder('Tu nombre').fill('Beto')
  await beto.getByRole('button', { name: 'Unirme' }).click()
  await beto.getByText(/Abandonaste esta partida/).waitFor({ timeout: 40000 })
  comprobar(true, 'al intentar volver ve «Abandonaste esta partida: no puedes volver a entrar»')
  comprobar(await beto.getByRole('button', { name: 'Unirme' }).isDisabled(), 'el botón «Unirme» queda bloqueado')
  await beto.screenshot({ path: 'capturas/salir-no-reingreso-movil.png' })

  // 5. La anfitriona sale: aviso claro y la sala se cierra para todos al instante.
  await botonSalir(ana).click()
  const dialogoAna = ana.getByRole('alertdialog')
  await dialogoAna.waitFor()
  comprobar(
    (await dialogoAna.innerText()).includes('se cerrará para todos los jugadores'),
    'al anfitrión se le avisa de que la partida se cierra para todos',
  )
  await ana.screenshot({ path: 'capturas/salir-anfitrion-confirmacion-movil.png', fullPage: true })
  await ana.getByRole('button', { name: 'Sí, cerrar la sala para todos' }).click()
  await carla.getByText('El anfitrión cerró la sala.').waitFor({ timeout: 8000 })
  comprobar(true, 'Carla ve «El anfitrión cerró la sala.» enseguida (sin esperar a reintentos)')
} catch (e) {
  comprobar(false, `excepción: ${e.message}`)
  // Diagnóstico: qué mostraba cada pantalla.
  for (const [n, p] of Object.entries(paginas)) {
    const texto = await p.locator('body').innerText().catch(() => '(sin acceso)')
    console.log(`--- pantalla de ${n} ---`)
    console.log(texto.split(/\s*\n+\s*/).join(' | ').slice(0, 400))
    const campos = await p
      .evaluate(() => [...document.querySelectorAll('input')].map((i) => `${i.placeholder}="${i.value}"`).join(', '))
      .catch(() => '')
    if (campos) console.log(`campos: ${campos}`)
  }
} finally {
  await navegador.close()
}
console.log(fallos.length ? `\n${fallos.length} fallo(s)` : '\nTodo correcto')
process.exit(fallos.length ? 1 : 0)
