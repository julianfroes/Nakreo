import { useEffect, useMemo, useRef } from 'react'
import type { EstadoProyectado } from '../../game/proyeccion'
import { Button } from '../../shared/components/Button'
import { detectarSenal, vibrar } from '../feedback'
import { useCliente } from '../store'
import { calcularVista, nombreDe, type Vista } from '../vista'
import { BarraEstado } from './BarraEstado'
import { ElegirCartaAPerder, ModalDefensa, Reasignacion } from './Decisiones'
import { Mano } from './Mano'
import { PanelAcciones } from './PanelAcciones'
import { PanelRespuesta } from './PanelRespuesta'
import { PantallaFinal } from './Pantallas'

/** Pantalla de juego: cabecera, mis cartas y el panel que corresponda a la fase. */
export function Juego({ p }: { p: EstadoProyectado }) {
  const { enviar, pendiente, conexion, intento, error, limpiarError, salir } = useCliente()
  const vista = useMemo(() => calcularVista(p), [p])

  // Feedback (vibración) solo en transiciones de vista: mi turno, me desafían...
  const anterior = useRef<Vista | null>(null)
  useEffect(() => {
    const senal = detectarSenal(anterior.current, vista)
    anterior.current = vista
    if (senal) vibrar(senal)
  }, [vista])

  // Los errores del host (p. ej. intención ilegal) se muestran unos segundos.
  useEffect(() => {
    if (!error) return
    const t = setTimeout(limpiarError, 3500)
    return () => clearTimeout(t)
  }, [error, limpiarError])

  if (vista.tipo === 'fin') {
    return <PantallaFinal ganador={nombreDe(p, vista.ganador)} gane={vista.gane} />
  }

  // Cambia en cada decisión nueva, para reiniciar la selección de los overlays.
  const claveDecision = `${p.turno}-${p.registro.length}`

  return (
    <div className="mx-auto flex min-h-dvh max-w-md flex-col">
      {conexion === 'reconectando' && (
        <p role="status" className="bg-amber-500 px-4 py-2 text-center text-sm font-semibold text-slate-950">
          Conexión perdida. Reconectando… (intento {intento})
        </p>
      )}
      <BarraEstado p={p} />
      <div className="flex-1">
        <Mano mano={p.yo.mano} />
      </div>

      {/* Con muchas acciones (mi turno) el panel fluye con la página para no tapar mis cartas;
          las respuestas cortas quedan fijas abajo. */}
      <section
        className={`space-y-2 border-t border-slate-800 bg-slate-950/95 p-4 pb-[max(1rem,env(safe-area-inset-bottom))] backdrop-blur ${
          vista.tipo === 'elegirAccion' ? '' : 'sticky bottom-0'
        }`}
      >
        {error && (
          <p role="alert" className="rounded-lg bg-rose-900/70 px-3 py-2 text-center text-sm">
            {error}
          </p>
        )}
        {vista.tipo === 'elegirAccion' && (
          <PanelAcciones
            acciones={vista.acciones}
            objetivos={vista.objetivos}
            pendiente={pendiente}
            onElegir={(accion, objetivo) => enviar({ tipo: 'elegirAccion', accion, objetivo })}
          />
        )}
        {(vista.tipo === 'responderDesafio' ||
          vista.tipo === 'responderBloqueo' ||
          vista.tipo === 'responderDesafioBloqueo') && (
          <PanelRespuesta p={p} vista={vista} pendiente={pendiente} enviar={enviar} />
        )}
        {vista.tipo === 'esperando' && (
          <p className="py-3 text-center text-slate-300">{vista.mensaje}</p>
        )}
        {vista.tipo === 'eliminado' && (
          <>
            <p className="py-2 text-center text-slate-300">Has sido eliminado. Sigues como espectador.</p>
            <Button variant="secondary" onClick={salir}>Salir</Button>
          </>
        )}
        {pendiente && <p className="text-center text-xs text-slate-500">Enviando…</p>}
      </section>

      {vista.tipo === 'defenderse' && (
        <ModalDefensa key={claveDecision} p={p} pendiente={pendiente} enviar={enviar} {...vista} />
      )}
      {vista.tipo === 'perderCarta' && (
        <ElegirCartaAPerder key={claveDecision} p={p} pendiente={pendiente} enviar={enviar} />
      )}
      {vista.tipo === 'reasignar' && (
        <Reasignacion
          key={claveDecision}
          pendiente={pendiente}
          enviar={enviar}
          opciones={vista.opciones}
          cuantas={vista.cuantas}
        />
      )}
    </div>
  )
}
