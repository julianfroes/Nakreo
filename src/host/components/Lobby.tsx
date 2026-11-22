import QRCode from 'qrcode'
import { useEffect, useState } from 'react'
import { MAX_JUGADORES, MIN_JUGADORES } from '../../game/config'
import { Button } from '../../shared/components/Button'
import { navigate } from '../../shared/useHashRoute'
import type { SnapshotHost } from '../HostServidor'
import { useHost } from '../hostStore'

import { AvisoSenalizacion } from './AvisoSenalizacion'

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

export function Lobby({ s }: { s: SnapshotHost }) {
  const { iniciarPartida, cerrarSala } = useHost()
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
              placeholder="http://192.168.1.20:5173/nakreo/"
            />
          </label>
        )}
      </section>

      <section className="flex w-full max-w-md flex-col gap-4">
        <h2 className="text-2xl font-bold">
          Jugadores <span className="text-slate-500">{s.jugadores.length}/{MAX_JUGADORES}</span>
        </h2>
        <ul className="min-h-40 space-y-2">
          {s.jugadores.length === 0 && <li className="text-slate-500">Esperando jugadores…</li>}
          {s.jugadores.map((j) => (
            <li
              key={j.id}
              className="flex items-center justify-between rounded-xl border border-slate-700 bg-slate-900 px-4 py-3 text-lg"
            >
              <span className="font-semibold">{j.nombre}</span>
              <span className={j.conectado ? 'text-emerald-400' : 'text-slate-500'}>
                {j.conectado ? '● conectado' : '○ desconectado'}
              </span>
            </li>
          ))}
        </ul>
        <Button disabled={!s.puedeIniciar} onClick={iniciarPartida}>
          Iniciar partida
        </Button>
        {!s.puedeIniciar && (
          <p className="text-center text-sm text-slate-500">
            Se necesitan entre {MIN_JUGADORES} y {MAX_JUGADORES} jugadores, todos conectados.
          </p>
        )}
        <Button variant="secondary" onClick={() => { cerrarSala(); navigate('/') }}>
          Cerrar sala
        </Button>
      </section>
    </main>
  )
}
