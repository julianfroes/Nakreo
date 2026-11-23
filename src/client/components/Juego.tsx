import { useEffect, useMemo, useRef, type ReactNode } from 'react'
import type { EstadoProyectado } from '../../game/proyeccion'
import { Button } from '../../shared/components/Button'
import { useEsEscritorio } from '../../shared/useMediaQuery'
import { detectarSenal, vibrar } from '../feedback'
import { useCliente } from '../store'
import { calcularVista, nombreDe, type Vista } from '../vista'
import { BarraEstado } from './BarraEstado'
import { ElegirCartaAPerder, ModalDefensa, Reasignacion } from './Decisiones'
import { HerramientasPartida } from './HerramientasPartida'
import { Mano } from './Mano'
import { PanelAcciones } from './PanelAcciones'
import { PanelRespuesta } from './PanelRespuesta'
import { PantallaFinal, PantallaRetirado } from './Pantallas'
import { RegistroReciente } from './RegistroReciente'
import { SalirConfirmar } from './SalirConfirmar'

/**
 * Pantalla de juego del jugador.
 *  - Móvil: una columna (cabecera fija con rivales, mis cartas y, abajo, el panel de decisiones).
 *  - Ordenador (≥ 1024 px): dos paneles centrados y con ancho máximo. A la izquierda mi situación
 *    (mis datos, los rivales, mis cartas y las consultas); a la derecha mis decisiones, con más espacio,
 *    y el registro de lo que acaba de pasar.
 */
interface Props {
  p: EstadoProyectado
  /** El anfitrión también juega: sin "Salir" (cerrar sala es otra acción). */
  modoAnfitrion?: boolean
  /** Control extra (p. ej. cerrar sala) bajo mis cartas. */
  menuAnfitrion?: ReactNode
  /** Sustituye al botón "Salir" en la pantalla de fin (reiniciar, volver al lobby...). */
  controlesFin?: ReactNode
}

export function Juego({ p, modoAnfitrion = false, menuAnfitrion, controlesFin }: Props) {
  const { enviar, pendiente, conexion, intento, error, limpiarError, abandonar } = useCliente()
  const vista = useMemo(() => calcularVista(p), [p])
  const esEscritorio = useEsEscritorio()

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

  if (vista.tipo === 'retirado') return <PantallaRetirado />

  if (vista.tipo === 'fin') {
    return <PantallaFinal ganador={nombreDe(p, vista.ganador)} gane={vista.gane} controles={controlesFin} />
  }

  // Decisiones que tapan la pantalla: la Guía rápida se cierra para no estorbar.
  const decisionUrgente =
    vista.tipo === 'defenderse' || vista.tipo === 'perderCarta' || vista.tipo === 'reasignar'

  // Cambia en cada decisión nueva, para reiniciar la selección de los overlays.
  const claveDecision = `${p.turno}-${p.registro.length}`

  return (
    <div className="mx-auto max-w-md md:max-w-xl lg:max-w-6xl lg:px-6 lg:py-6">
      <div className="flex min-h-dvh flex-col lg:grid lg:min-h-0 lg:grid-cols-[minmax(0,1fr)_28rem] lg:items-start lg:gap-6 xl:grid-cols-[minmax(0,1fr)_32rem]">
        {conexion === 'reconectando' && (
          <p
            role="status"
            className="bg-amber-500 px-4 py-2 text-center text-sm font-semibold text-slate-950 lg:col-span-2 lg:rounded-xl"
          >
            Conexión perdida. Reconectando… (intento {intento})
          </p>
        )}

        {/* En móvil este contenedor «desaparece» (así la cabecera sigue fija al hacer scroll);
            en ordenador es el panel izquierdo. */}
        <div className="contents lg:flex lg:flex-col lg:gap-5">
          <BarraEstado p={p} />
          <div className="flex-1 lg:flex-none">
            <Mano mano={p.yo.mano} />
            {/* Zona secundaria, lejos de las acciones: consultas (guía, descarte) y salir de la
                partida (el anfitrión, en cambio, cierra la sala). */}
            <div className="space-y-3 px-4 pb-4 lg:px-0 lg:pb-0 lg:pt-4">
              <HerramientasPartida p={p} urgente={decisionUrgente} />
              {menuAnfitrion ?? (vista.tipo !== 'eliminado' && <SalirConfirmar />)}
            </div>
          </div>
        </div>

        {/* Con muchas acciones (mi turno) el panel fluye con la página para no tapar mis cartas;
            las respuestas cortas quedan fijas abajo. En ordenador es el panel derecho, fijo. */}
        <section
          aria-label="Tus decisiones"
          className={`space-y-2 border-t border-slate-800 bg-slate-950/95 p-4 pb-[max(1rem,env(safe-area-inset-bottom))] backdrop-blur ${
            vista.tipo === 'elegirAccion' ? '' : 'sticky bottom-0'
          } lg:sticky lg:bottom-auto lg:top-6 lg:max-h-[calc(100dvh-3rem)] lg:space-y-3 lg:overflow-y-auto lg:rounded-3xl lg:border lg:border-slate-700 lg:bg-slate-900/80 lg:p-5`}
        >
          <h2 className="hidden text-xs font-semibold uppercase tracking-widest text-slate-400 lg:block">
            Tus decisiones
          </h2>
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
            vista.tipo === 'responderDesafioBloqueo' ||
            vista.tipo === 'responderDesafioReaccion' ||
            vista.tipo === 'explotarSite') && (
            <PanelRespuesta p={p} vista={vista} pendiente={pendiente} enviar={enviar} />
          )}
          {vista.tipo === 'esperando' && (
            <p className="py-3 text-center text-slate-300 lg:py-6 lg:text-lg">{vista.mensaje}</p>
          )}
          {vista.tipo === 'eliminado' && (
            <>
              <p className="py-2 text-center text-slate-300">Has sido eliminado. Sigues como espectador.</p>
              {!modoAnfitrion && (
                <Button variant="secondary" onClick={abandonar}>
                  Salir
                </Button>
              )}
            </>
          )}
          {pendiente && <p className="text-center text-xs text-slate-500">Enviando…</p>}
          {esEscritorio && <RegistroReciente p={p} />}
        </section>
      </div>

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
