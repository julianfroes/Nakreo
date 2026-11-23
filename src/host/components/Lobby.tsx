import QRCode from 'qrcode'
import { useEffect, useState } from 'react'
import { MAX_JUGADORES_SIN_ESPECIALES } from '../../game/config'
import { useCliente } from '../../client/store'
import { Button } from '../../shared/components/Button'
import { Aforo, EstadoJugadorSala } from '../../shared/components/EstadoJugadorSala'
import { PanelReglas } from '../../shared/components/PanelReglas'
import { nombreModo } from '../../shared/reglasContenido'
import { navigate } from '../../shared/useHashRoute'
import type { SnapshotHost } from '../HostServidor'
import { useHost } from '../hostStore'

import { AvisoSenalizacion } from './AvisoSenalizacion'
import { InterruptorModo } from './InterruptorModo'
import { UnirmeComoJugador } from './UnirmeComoJugador'

const CLAVE_URL = 'nakreo-url-base'
const esLocal = ['localhost', '127.0.0.1', '[::1]'].includes(location.hostname)

/** URL del juego sin hash. En desarrollo local puede editarse (los móviles no ven "localhost"). */
function urlBaseInicial(): string {
  const porDefecto = location.origin + import.meta.env.BASE_URL
  return (esLocal && localStorage.getItem(CLAVE_URL)) || porDefecto
}

const urlUnirse = (base: string, codigo: string) =>
  `${base.endsWith('/') ? base : base + '/'}#/join?room=${codigo}`

function QR({ url }: { url: string }) {
  const [src, setSrc] = useState('')
  useEffect(() => {
    let vigente = true
    // SVG: nítido en TV. Se muestra como imagen (data URI), sin inyectar HTML.
    QRCode.toString(url, { type: 'svg', margin: 1, errorCorrectionLevel: 'M' }).then((svg) => {
      if (vigente) setSrc(`data:image/svg+xml;utf8,${encodeURIComponent(svg)}`)
    })
    return () => {
      vigente = false
    }
  }, [url])
  return (
    <div className="aspect-square w-64 rounded-2xl bg-white p-2 sm:w-72 xl:w-80">
      {src && <img src={src} alt={`Código QR para unirse: ${url}`} className="h-full w-full" />}
    </div>
  )
}

/**
 * Sala de espera del anfitrión: código, QR, modo (editable hasta iniciar), aforo
 * y jugadores con su estado. El anfitrión puede ocupar un asiento (o dejarlo) hasta iniciar.
 */
export function Lobby({ s }: { s: SnapshotHost }) {
  const { iniciarPartida, cerrarSala, cambiarModo, dejarAsiento, error } = useHost()
  const [reglas, setReglas] = useState(false)
  const miId = s.asientoLocal
  const marcarListo = useCliente((c) => c.marcarListo)
  const yo = miId ? s.jugadores.find((j) => j.id === miId) : undefined
  const conectados = s.jugadores.filter((j) => j.conectado).length
  const listos = s.jugadores.filter((j) => j.conectado && j.listo).length
  // Pasar a «sin roles especiales» no cabe si ya hay más jugadores que su aforo.
  const noCabeSinEspeciales = s.especiales && s.jugadores.length > MAX_JUGADORES_SIN_ESPECIALES
  const [base, setBase] = useState(urlBaseInicial)
  const url = urlUnirse(base, s.codigo)

  return (
    <main className="mx-auto flex min-h-dvh max-w-6xl flex-col gap-8 p-6 lg:flex-row lg:items-center lg:justify-center">
      {!s.senalizacionOk && <AvisoSenalizacion />}
      <section className="flex flex-col items-center gap-4">
        <p className="text-slate-400">Únete con el código</p>
        <p className="font-mono text-7xl font-bold tracking-[0.2em] sm:text-8xl xl:text-9xl">{s.codigo}</p>
        <QR url={url} />
        <p className="max-w-xs break-all text-center text-sm text-slate-500">{url}</p>
        {esLocal && (
          <label className="w-full max-w-sm text-sm text-amber-400">
            Estás en localhost: los móviles no pueden verlo. Escribe la URL de tu equipo en la red:
            <input
              className="mt-1 w-full rounded-lg border border-slate-600 bg-slate-900 px-3 py-2 text-slate-100"
              value={base}
              onChange={(e) => {
                setBase(e.target.value)
                localStorage.setItem(CLAVE_URL, e.target.value)
              }}
              placeholder="http://192.168.1.20:5173/Nakreo/"
            />
          </label>
        )}
      </section>

      <section className="flex w-full max-w-md flex-col gap-4">
        <InterruptorModo
          sinEspeciales={!s.especiales}
          onCambio={(sin) => cambiarModo(!sin)}
          deshabilitado={noCabeSinEspeciales}
          aviso={
            noCabeSinEspeciales
              ? `Hay ${s.jugadores.length} jugadores: sin roles especiales caben ${MAX_JUGADORES_SIN_ESPECIALES} como máximo.`
              : null
          }
        />
        <h2 className="text-2xl font-bold">
          Jugadores{' '}
          <span className="text-slate-400">
            <Aforo actual={s.jugadores.length} max={s.max} />
          </span>
        </h2>
        <p className="-mt-2 text-sm text-slate-400">
          {nombreModo(s.especiales)} · {listos}/{conectados} listos (es solo una guía: no impide iniciar)
        </p>
        <ul className="min-h-40 space-y-2">
          {s.jugadores.length === 0 && <li className="text-slate-500">Esperando jugadores…</li>}
          {s.jugadores.map((j) => (
            <li
              key={j.id}
              className="flex items-center justify-between rounded-xl border border-slate-700 bg-slate-900 px-4 py-3 text-lg"
            >
              <span className="font-semibold">
                {j.nombre} {j.id === miId && <span className="text-cyan-400">(tú)</span>}
              </span>
              <EstadoJugadorSala j={j} />
            </li>
          ))}
        </ul>
        {yo && (
          <Button variant="secondary" aria-pressed={yo.listo} onClick={() => marcarListo(!yo.listo)}>
            {yo.listo ? 'Ya no estoy listo' : 'Estoy listo'}
          </Button>
        )}
        <Button disabled={!s.puedeIniciar} onClick={iniciarPartida}>
          Iniciar partida
        </Button>
        {s.motivoBloqueo && <p className="text-center text-sm text-slate-400">{s.motivoBloqueo}</p>}
        {error && (
          <p role="alert" className="text-center text-sm text-rose-300">
            {error}
          </p>
        )}
        {yo ? (
          <Button variant="secondary" onClick={dejarAsiento}>
            Dejar mi asiento (volver a ser solo la mesa)
          </Button>
        ) : (
          <UnirmeComoJugador s={s} />
        )}
        <Button variant="secondary" onClick={() => setReglas(true)}>
          <span aria-hidden>📖</span> Reglas
        </Button>
        <PanelReglas abierto={reglas} onCerrar={() => setReglas(false)} modo="reglas" especiales={s.especiales} />
        <Button variant="secondary" onClick={() => { cerrarSala(); navigate('/') }}>
          Cerrar sala
        </Button>
      </section>
    </main>
  )
}
