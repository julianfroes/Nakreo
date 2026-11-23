// Prueba de extremo a extremo: el objetivo de un Despido ve A LA VEZ «Alegar Sindicalizado» y
// «Explotar el site» (no hay «Alegar Ingeniero»), y si su bloqueo cae todavía puede explotar el site.
// Dos navegadores con WebRTC real; las manos se fuerzan con `window.nakreo` (solo existe en desarrollo).
// Requiere `npm run dev` en marcha, internet (señalización de PeerJS) y Edge/Chrome.
//   node scripts/e2e-bloqueo-despido.mjs [urlBase]
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
const encabezadoMano = (p) => p.getByText('Tus cartas (solo tú las ves)', { exact: true })

try {
  const ana = await (await navegador.newContext(movil)).newPage()
  const beto = await (await navegador.newContext(movil)).newPage()
  paginas.Ana = ana
  paginas.Beto = beto
  for (const [n, p] of Object.entries(paginas)) p.on('pageerror', (e) => comprobar(false, `error de página (${n}): ${e.message}`))

  // 1. Sala de dos: Ana (anfitriona-jugadora) y Beto.
  await ana.goto(`${base}#/host?jugar=1`)
  await ana.getByPlaceholder('Tu nombre').fill('Ana')
  await ana.getByRole('button', { name: 'Crear sala' }).click()
  const codigo = (await ana.locator('.font-mono').first().innerText({ timeout: 30000 })).trim()
  await beto.goto(`${base}#/join?room=${codigo}`)
  await beto.getByPlaceholder('Tu nombre').fill('Beto')
  await beto.getByRole('button', { name: 'Unirme' }).click()
  await beto.getByText('Esperando a que el anfitrión inicie').waitFor({ timeout: 40000 })
  await ana.getByLabel('2 de 8 jugadores').waitFor({ timeout: 10000 })
  await ana.getByRole('button', { name: 'Iniciar partida' }).click()
  await encabezadoMano(ana).waitFor({ timeout: 15000 })
  await encabezadoMano(beto).waitFor({ timeout: 15000 })
  comprobar(true, `partida iniciada (sala ${codigo})`)

  // 2. Manos forzadas: Ana es CEO (3 ◈); Beto NO es Sindicalizado, pero sí Ingeniero Especial (5 ◈).
  await ana.evaluate(() => {
    const h = window.nakreo
    const e = h.estado
    const poner = (j, defs) =>
      defs.forEach(([rol, especial], k) => {
        const c = j.cartas[k]
        c.rol = rol
        c.revelada = false
        if (especial) c.especial = true
        else delete c.especial
      })
    poner(e.jugadores[0], [['ceo', false], ['rh', false]])
    poner(e.jugadores[1], [['ceo', false], ['ingeniero', true]])
    e.jugadores[0].creditos = 3
    e.jugadores[1].creditos = 5
    e.jugadorActivo = e.jugadores[0].id
    e.fase = { tipo: 'accion' }
    h.difundirEstado([])
    h.notificar()
  })
  await ana.getByText('¡Tu turno!').waitFor({ timeout: 10000 })
  await beto.getByText('Ingeniero Especial').first().waitFor({ timeout: 10000 })
  comprobar(true, 'manos forzadas: Ana CEO, Beto con un CEO y el Ingeniero Especial')

  // 3. Ana despide a Beto; Beto deja pasar el desafío al CEO.
  await boton(ana, /Despido/).click()
  await boton(ana, /^Beto/).click()
  await boton(beto, 'Dejar pasar').click()

  // 4. LO IMPORTANTE: Beto ve a la vez el bloqueo con Sindicalizado y «Explotar el site».
  await boton(beto, /Alegar .*Sindicalizado/).waitFor({ timeout: 15000 })
  await boton(beto, /Explotar el site/).waitFor({ timeout: 5000 })
  const visibles = {
    sindicalizado: await boton(beto, /Alegar .*Sindicalizado/).isVisible(),
    explotar: await boton(beto, /Explotar el site/).isVisible(),
    pasar: await boton(beto, 'Dejar pasar').isVisible(),
  }
  comprobar(visibles.sindicalizado && visibles.explotar && visibles.pasar, 'Beto ve a la vez «Alegar Sindicalizado», «Explotar el site» y «Dejar pasar»')
  comprobar((await boton(beto, /Alegar .*Ingeniero/).count()) === 0, 'no existe «Alegar Ingeniero»: el Ingeniero no bloquea el Despido')
  await beto.screenshot({ path: 'capturas/despido-reacciones-movil.png' })

  // 5. Beto farolea el bloqueo con Sindicalizado; Ana lo desafía; el farol cae.
  await boton(beto, /Alegar .*Sindicalizado/).click()
  await boton(ana, 'Desafiar el bloqueo').click()
  await beto.getByRole('heading', { name: /te desafía/ }).waitFor({ timeout: 15000 })
  await boton(beto, /CEO/).click() // muestra un CEO: no es Sindicalizado
  await boton(beto, 'Mostrar carta').click()

  // 6. SEGUNDA OPORTUNIDAD: con el bloqueo caído, Beto todavía puede explotar el site.
  await boton(beto, /Explotar el site/).waitFor({ timeout: 15000 })
  comprobar(true, 'tras caer el bloqueo, Beto aún puede explotar el site')
  comprobar((await boton(beto, /Alegar/).count()) === 0, 'en la segunda oportunidad ya no se ofrece bloquear')
  await boton(beto, /Explotar el site/).click()
  await boton(ana, 'Dejar pasar').click() // Ana no desafía la explosión

  // 7. Ana pierde una carta primero (explosión) y después el Despido cae sobre la última carta de Beto.
  await ana.getByRole('heading', { name: 'Pierdes una carta' }).waitFor({ timeout: 15000 })
  await ana.getByRole('button', { name: /RH|CEO/ }).first().click()
  await boton(ana, 'Perder esta carta').click()
  await ana.getByText('¡Has ganado!').waitFor({ timeout: 15000 })
  await beto.getByText('Partida terminada').waitFor({ timeout: 15000 })
  comprobar(true, 'la explosión golpeó primero a Ana y luego Beto fue eliminado: gana Ana')
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
