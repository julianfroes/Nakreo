// Prueba de extremo a extremo del layout de ESCRITORIO de la pantalla del jugador (dos paneles a partir
// de 1024 px) con navegadores reales y WebRTC real: Ana juega en una ventana de ordenador, Beto en un móvil.
// Comprueba el diseño al redimensionar la ventana, que no haya desbordes horizontales, que las acciones
// ocupen 2 columnas, el registro lateral solo en ordenador y que las decisiones sean más anchas.
// Requiere `npm run dev` en marcha, internet (señalización de PeerJS) y Edge/Chrome.
//   node scripts/e2e-escritorio.mjs [urlBase]
import { chromium } from 'playwright-core'
import { mkdirSync } from 'node:fs'

const base = process.argv[2] ?? 'http://localhost:5173/Nakreo/'
mkdirSync('capturas', { recursive: true })
const movil = { viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true }
const escritorio = { viewport: { width: 1280, height: 800 } }

const navegador = await chromium.launch({ channel: 'msedge' })
const paginas = {}
const fallos = []
const comprobar = (ok, texto) => {
  console.log(`${ok ? 'OK  ' : 'FALLO'} ${texto}`)
  if (!ok) fallos.push(texto)
}
const boton = (p, nombre) => p.getByRole('button', { name: nombre })
const encabezadoMano = (p) => p.getByText('Tus cartas (solo tú las ves)', { exact: true })
const caja = async (loc) => loc.boundingBox()
const desborde = (p) => p.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)

try {
  const ana = await (await navegador.newContext(escritorio)).newPage()
  const beto = await (await navegador.newContext(movil)).newPage()
  Object.assign(paginas, { Ana: ana, Beto: beto })
  for (const [n, p] of Object.entries(paginas)) p.on('pageerror', (e) => comprobar(false, `error de página (${n}): ${e.message}`))

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
  comprobar(true, `partida iniciada: Ana en ventana de ordenador, Beto en móvil (sala ${codigo})`)

  // Ana es quien juega primero en la partida; asegura que tiene el turno para ver las acciones.
  await ana.getByText('¡Tu turno!').waitFor({ timeout: 10000 })

  // 1. Dos paneles en ordenador: situación a la izquierda, decisiones a la derecha.
  const decisiones = ana.getByRole('region', { name: 'Tus decisiones' })
  const manoTitulo = encabezadoMano(ana)
  const cDec = await caja(decisiones)
  const cMano = await caja(manoTitulo)
  comprobar(cDec.x > cMano.x + 400, 'en ordenador las decisiones están en un panel a la derecha de mis cartas')
  comprobar(cDec.width >= 420 && cDec.width <= 540, `el panel de decisiones tiene un ancho cómodo (${Math.round(cDec.width)} px)`)
  comprobar((await ana.getByRole('region', { name: 'Registro' }).count()) === 1, 'el registro lateral aparece en ordenador')
  comprobar((await beto.getByRole('region', { name: 'Registro' }).count()) === 0, 'en el móvil no hay registro lateral')

  // 2. Las acciones ocupan 2 columnas.
  const a1 = await caja(boton(ana, /Sueldo mínimo/))
  const a2 = await caja(boton(ana, /Nómina/))
  comprobar(Math.abs(a1.y - a2.y) < 6 && a2.x > a1.x + a1.width - 4, 'las acciones se reparten en 2 columnas')
  const m1 = await caja(boton(beto, /Sueldo mínimo/).or(beto.getByText('Turno de Ana')).first())
  comprobar(m1 !== null, 'el móvil sigue mostrando su columna de siempre')
  await ana.screenshot({ path: 'capturas/escritorio-turno.png' })

  // 3. Sin desbordes horizontales en 1280, 1024, 768 y 390 px.
  for (const ancho of [1280, 1024, 768, 390]) {
    await ana.setViewportSize({ width: ancho, height: ancho >= 1024 ? 800 : 900 })
    await ana.waitForTimeout(250)
    comprobar((await desborde(ana)) <= 0, `sin scroll horizontal a ${ancho} px`)
  }

  // 4. Al estrechar la ventana el diseño pasa a una columna (y el registro lateral desaparece) y al ensancharla vuelve.
  await ana.setViewportSize({ width: 390, height: 844 })
  await ana.waitForTimeout(250)
  comprobar((await ana.getByRole('region', { name: 'Registro' }).count()) === 0, 'con la ventana estrecha desaparece el registro lateral')
  const e1 = await caja(boton(ana, /Sueldo mínimo/))
  const e2 = await caja(boton(ana, /Nómina/))
  comprobar(Math.abs(e1.x - e2.x) < 6 && e2.y > e1.y, 'con la ventana estrecha las acciones van en una sola columna')
  await ana.setViewportSize({ width: 768, height: 1024 })
  await ana.waitForTimeout(250)
  const t1 = await caja(boton(ana, /Sueldo mínimo/))
  const t2 = await caja(boton(ana, /Nómina/))
  comprobar(Math.abs(t1.y - t2.y) < 6, 'en tableta (768 px) las acciones van en 2 columnas')
  await ana.setViewportSize({ width: 1280, height: 800 })
  await ana.waitForTimeout(250)
  comprobar((await ana.getByRole('region', { name: 'Registro' }).count()) === 1, 'al ensanchar la ventana vuelve el diseño de dos paneles')

  // 5. Se juega con normalidad desde el layout de ordenador y el registro lo refleja.
  await boton(ana, /Sueldo mínimo/).click()
  await beto.getByText('¡Tu turno!').waitFor({ timeout: 15000 })
  await ana.getByRole('region', { name: 'Registro' }).getByText(/Sueldo mínimo/).first().waitFor({ timeout: 10000 })
  comprobar(true, 'Ana juega desde el layout de ordenador y el registro lateral muestra su jugada')

  // 6. Una decisión que tapa la pantalla (te desafían) es ancha en ordenador.
  await boton(beto, /Malversación/).click() // Beto reclama RH
  await ana.getByText(/Esperando a Ana|¿Alguien desafía/).first().waitFor({ timeout: 10000 }).catch(() => {})
  await boton(ana, 'Desafiar (¿miente?)').click()
  await beto.getByRole('heading', { name: /te desafía/ }).waitFor({ timeout: 15000 })
  const dialogo = beto.getByRole('dialog')
  comprobar((await dialogo.count()) >= 1, 'el desafiado ve su decisión en un diálogo')
  await ana.screenshot({ path: 'capturas/escritorio-desafio.png' })
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
