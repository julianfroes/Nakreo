import { useEffect, useRef } from 'react'
import type { EstadoPublico, JugadorPublico } from '../../game/proyeccion'
import { MIN_JUGADORES } from '../../game/config'
import { Button } from '../../shared/components/Button'
import { nombreModo } from '../../shared/reglasContenido'
import { IconoRol } from '../../shared/iconos/IconoRol'
import { uiCarta } from '../../shared/rolesUI'
import { colorEvento, describirFase, textoEvento } from '../../shared/textos'
import { navigate } from '../../shared/useHashRoute'
import type { SnapshotHost } from '../HostServidor'
import { AvisoSenalizacion } from './AvisoSenalizacion'
import { CerrarSalaConfirmar } from './ControlesAnfitrion'
import { useHost } from '../hostStore'

/** Cuántos eventos recientes se considera "reciente" para resaltar la última carta mostrada. */
const VENTANA_CARTA_MOSTRADA = 8

function TarjetaJugador({
  j, activo, conectado,
}: { j: JugadorPublico; activo: boolean; conectado: boolean }) {
  return (
    <li
      className={`rounded-2xl border-2 p-4 transition-colors ${
        j.eliminado
          ? 'border-slate-800 bg-slate-900/40 opacity-50'
          : activo
            ? 'animate-latido border-cyan-400 bg-cyan-950/40'
            : 'border-slate-700 bg-slate-900'
      }`}
    >
      <div className="flex items-baseline justify-between gap-2">
        <h3 className={`truncate text-xl font-bold xl:text-2xl 2xl:text-4xl ${j.eliminado ? 'line-through' : ''}`}>{j.nombre}</h3>
        <span className="text-2xl font-bold text-amber-300 xl:text-3xl 2xl:text-5xl">◈ {j.creditos}</span>
      </div>
      <div className="mt-2 flex flex-wrap items-center gap-2 text-sm">
        {activo && !j.eliminado && <span className="rounded bg-cyan-500 px-2 py-0.5 font-bold text-slate-950">TURNO</span>}
        {j.eliminado && (
          <span className="rounded bg-rose-800 px-2 py-0.5 font-bold">{j.retirado ? 'RETIRADO' : 'ELIMINADO'}</span>
        )}
        {!conectado && !j.eliminado && <span className="rounded bg-amber-600 px-2 py-0.5 font-bold text-slate-950">DESCONECTADO</span>}
      </div>
      <div className="mt-3 flex flex-wrap items-center gap-2">
        {Array.from({ length: j.cartasVivas }, (_, i) => (
          <span key={i} className="flex h-12 w-9 items-center justify-center rounded-md border border-slate-500 bg-slate-800 text-2xl 2xl:h-20 2xl:w-14 2xl:text-4xl" aria-label="Carta oculta">
            🂠
          </span>
        ))}
        {j.cartasReveladas.map((c, i) => (
          <span
            key={i}
            className={`rounded-md border px-2 py-1 text-sm opacity-70 2xl:px-3 2xl:py-2 2xl:text-xl ${uiCarta(c.rol, c.especial).borde}`}
            title="Carta perdida"
          >
            <span className="inline-flex items-center gap-1.5">
              <IconoRol rol={c.rol} especial={c.especial} tamano={24} decorativo className="2xl:size-8" />
              {uiCarta(c.rol, c.especial).nombre}
            </span>
          </span>
        ))}
      </div>
    </li>
  )
}

function CentroMesa({ mesa }: { mesa: EstadoPublico }) {
  const nombre = (id: string) => mesa.jugadores.find((j) => j.id === id)?.nombre ?? id
  const perdidas = mesa.jugadores.flatMap((j) => j.cartasReveladas.map((c) => ({ ...c, dueno: j.nombre })))

  // Última carta mostrada en un desafío, solo si ocurrió hace poco.
  const idx = mesa.registro.findLastIndex((e) => e.tipo === 'cartaMostrada')
  const mostrada = idx >= 0 && idx >= mesa.registro.length - VENTANA_CARTA_MOSTRADA ? mesa.registro[idx] : null

  return (
    <section className="flex flex-1 flex-col items-center justify-center gap-4 rounded-3xl border border-slate-700 bg-slate-900/60 p-6 text-center 2xl:gap-8">
      <p className="text-sm uppercase tracking-widest text-slate-500">
        Turno {mesa.turno} · {nombreModo(mesa.especiales)}
      </p>
      <p className="text-2xl font-semibold leading-snug xl:text-4xl 2xl:text-6xl">{describirFase(mesa)}</p>

      {mostrada?.tipo === 'cartaMostrada' && (
        <div key={idx} className={`animate-entrada rounded-2xl border-2 bg-gradient-to-b px-8 py-4 ${uiCarta(mostrada.rol, mostrada.especial).borde} ${uiCarta(mostrada.rol, mostrada.especial).fondo}`}>
          <p className="text-sm text-slate-300">{nombre(mostrada.jugador)} muestra</p>
          <div className="mx-auto my-1 size-16 2xl:size-24">
            <IconoRol rol={mostrada.rol} especial={mostrada.especial} tamano="auto" decorativo />
          </div>
          <p className="text-xl font-bold">{uiCarta(mostrada.rol, mostrada.especial).nombre}</p>
        </div>
      )}

      <div className="w-full">
        <p className="mb-2 text-sm text-slate-500">
          Cartas reveladas ({perdidas.length}) · Mazo: {mesa.mazoRestante}
        </p>
        <div className="flex flex-wrap justify-center gap-2">
          {perdidas.length === 0 && <span className="text-slate-600">Ninguna todavía</span>}
          {perdidas.map((c, i) => (
            <span key={i} className={`rounded-lg border px-3 py-2 ${uiCarta(c.rol, c.especial).borde}`} title={`Perdida por ${c.dueno}`}>
              <span className="inline-flex items-center gap-1.5">
                <IconoRol rol={c.rol} especial={c.especial} tamano={24} decorativo />
                <span className="text-sm">{uiCarta(c.rol, c.especial).nombre}</span>
              </span>
              <span className="block text-xs text-slate-500">{c.dueno}</span>
            </span>
          ))}
        </div>
      </div>
    </section>
  )
}

function Registro({ mesa }: { mesa: EstadoPublico }) {
  const lista = useRef<HTMLOListElement>(null)
  const nombre = (id: string) => mesa.jugadores.find((j) => j.id === id)?.nombre ?? id
  useEffect(() => {
    // Solo se desplaza el propio registro (scrollIntoView movería toda la página en móvil).
    const el = lista.current
    el?.scrollTo({ top: el.scrollHeight, behavior: 'smooth' })
  }, [mesa.registro.length])

  return (
    <aside className="flex max-h-[50dvh] min-h-0 flex-col rounded-3xl border border-slate-700 bg-slate-900/60 lg:max-h-none">
      <h2 className="border-b border-slate-700 px-4 py-3 text-lg font-bold">Registro</h2>
      <ol ref={lista} className="flex-1 space-y-1 overflow-y-auto px-4 py-3 text-base xl:text-lg 2xl:space-y-2 2xl:text-2xl" aria-live="polite">
        {mesa.registro.map((e, i) => (
          <li key={i} className={colorEvento(e.tipo)}>{textoEvento(e, nombre)}</li>
        ))}
      </ol>
      <div className="border-t border-slate-700 p-3">
        <CerrarSalaConfirmar />
      </div>
    </aside>
  )
}

export function Mesa({ s }: { s: SnapshotHost }) {
  const { cerrarSala, reiniciarPartida, volverAlLobby, error } = useHost()
  const mesa = s.mesa!
  const conectado = (id: string) => s.jugadores.find((j) => j.id === id)?.conectado ?? false
  const fase = mesa.fase
  const ganador = fase.tipo === 'fin' ? mesa.jugadores.find((j) => j.id === fase.ganador) : null

  return (
    <main className="grid min-h-dvh gap-4 p-4 lg:h-dvh lg:grid-cols-[1fr_24rem] lg:grid-rows-1 2xl:grid-cols-[1fr_32rem]">
      {!s.senalizacionOk && <AvisoSenalizacion />}
      <div className="flex min-h-0 flex-col gap-4 lg:overflow-y-auto">
        <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3 2xl:gap-5">
          {mesa.jugadores.map((j) => (
            <TarjetaJugador key={j.id} j={j} activo={j.id === mesa.jugadorActivo && mesa.fase.tipo !== 'fin'} conectado={conectado(j.id)} />
          ))}
        </ul>
        <CentroMesa mesa={mesa} />
      </div>
      <Registro mesa={mesa} />

      {ganador && (
        <div role="dialog" aria-modal="true" className="fixed inset-0 z-50 flex flex-col items-center justify-center gap-6 bg-slate-950/95 p-6 text-center animate-entrada">
          <p className="text-8xl">🏆</p>
          <h1 className="text-5xl font-bold xl:text-7xl">¡{ganador.nombre} gana!</h1>
          {error && <p role="alert" className="text-rose-300">{error}</p>}
          <div className="flex w-full max-w-xs flex-col gap-3">
            <Button disabled={s.jugadores.filter((j) => j.conectado).length < MIN_JUGADORES} onClick={reiniciarPartida}>
              Jugar de nuevo
            </Button>
            <Button variant="secondary" onClick={volverAlLobby}>Volver al lobby</Button>
            <Button variant="secondary" onClick={() => { cerrarSala(); navigate('/') }}>Cerrar sala</Button>
          </div>
          <p className="max-w-xs text-sm text-slate-500">
            «Jugar de nuevo» reparte cartas nuevas con los mismos jugadores conectados. «Volver al lobby» permite que entren jugadores nuevos.
          </p>
        </div>
      )}
    </main>
  )
}
