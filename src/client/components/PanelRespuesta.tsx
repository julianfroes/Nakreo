import type { EstadoProyectado } from '../../game/proyeccion'
import { reclamoDeAccion } from '../../game/roles'
import { Button } from '../../shared/components/Button'
import type { IntencionCliente } from '../../shared/protocolo'
import { EtiquetaRol, IconoRol } from '../../shared/iconos/IconoRol'
import { describirAccion } from '../../shared/textos'
import { nombreDe, type Vista } from '../vista'

type VistaRespuesta = Extract<
  Vista,
  {
    tipo:
      | 'responderDesafio'
      | 'responderBloqueo'
      | 'responderDesafioBloqueo'
      | 'responderDesafioReaccion'
      | 'explotarSite'
  }
>

interface Props {
  p: EstadoProyectado
  vista: VistaRespuesta
  pendiente: boolean
  enviar: (i: IntencionCliente) => void
}

/** Aviso del riesgo doble de los reclamos especiales. */
const AvisoEspecial = () => (
  <p className="text-center text-xs text-yellow-300">
    Reclamo especial: quien pierda el desafío pierde 2 cartas.
  </p>
)

/** Ventanas de respuesta: desafiar, bloquear, reaccionar o dejar pasar. */
export function PanelRespuesta({ p, vista, pendiente, enviar }: Props) {
  const nombre = (id: string) => nombreDe(p, id)
  const pasar = (
    <Button variant="secondary" disabled={pendiente} onClick={() => enviar({ tipo: 'pasar' })}>
      Dejar pasar
    </Button>
  )

  if (vista.tipo === 'responderDesafio') {
    const reclamo = reclamoDeAccion(vista.accion.tipo)!
    return (
      <div className="space-y-2 animate-entrada">
        <p className="text-center">
          {describirAccion(vista.accion, nombre)}
          <br />
          <span className="text-sm text-slate-400">
            Afirma ser <EtiquetaRol rol={reclamo.rol} especial={reclamo.especial} tamano={24} />
          </span>
        </p>
        {reclamo.especial && <AvisoEspecial />}
        <Button variant="danger" disabled={pendiente} onClick={() => enviar({ tipo: 'desafiar' })}>
          Desafiar (¿miente?)
        </Button>
        {pasar}
      </div>
    )
  }

  if (vista.tipo === 'responderBloqueo') {
    return (
      <div className="space-y-2 animate-entrada">
        <p className="text-center">{describirAccion(vista.accion, nombre)}</p>
        {/* Todas las reacciones posibles, a la vez y sin menús intermedios. */}
        {vista.roles.map((r) => (
          <Button
            key={`${r.rol}-${r.especial}`}
            variant="secondary"
            className="border-cyan-500"
            disabled={pendiente}
            onClick={() => enviar({ tipo: 'bloquear', rol: r.rol, especial: r.especial })}
          >
            <span className="inline-flex items-center justify-center gap-2">
              Alegar <EtiquetaRol rol={r.rol} especial={r.especial} tamano={24} />
            </span>
            {r.especial && <span className="ml-2 text-xs opacity-80">(un solo uso)</span>}
          </Button>
        ))}
        {vista.explosion && (
          <>
            <Button disabled={pendiente} onClick={() => enviar({ tipo: 'explotarSite' })}>
              💥 Explotar el site (Ingeniero Especial, ◈{vista.explosion.pago})
            </Button>
            <p className="text-center text-xs text-slate-400">
              Si nadie te desafía, el atacante pierde una carta antes que tú (un solo uso). Si prefieres
              bloquear y tu bloqueo cae, aún podrás explotar el site.
            </p>
            <AvisoEspecial />
          </>
        )}
        {pasar}
      </div>
    )
  }

  if (vista.tipo === 'explotarSite') {
    return (
      <div className="space-y-2 animate-entrada">
        <p className="text-center">
          {describirAccion(vista.accion, nombre)}
          <br />
          <span className="text-sm text-slate-400">Va a quitarte una carta.</span>
        </p>
        <Button disabled={pendiente} onClick={() => enviar({ tipo: 'explotarSite' })}>
          💥 Explotar el site (Ingeniero Especial, ◈{vista.pago})
        </Button>
        <p className="text-center text-xs text-slate-400">
          Si nadie te desafía, el atacante pierde una carta antes que tú. Un solo uso.
        </p>
        <AvisoEspecial />
        {pasar}
      </div>
    )
  }

  if (vista.tipo === 'responderDesafioReaccion') {
    const explosion = vista.reaccion.tipo === 'explosion'
    return (
      <div className="space-y-2 animate-entrada">
        <p className="text-center">
          {nombre(vista.reaccion.jugador)} declara{' '}
          {explosion ? (
            <>
              💥 <EtiquetaRol rol="ingeniero" especial tamano={24} />: ¡explota el site!
            </>
          ) : (
            <>
              <IconoRol rol="jefeArea" especial tamano={24} decorativo className="inline-block align-middle" /> Excusa de
              mérito (Jefe de Área Especial): se salva
            </>
          )}
          <br />
          <span className="text-sm text-slate-400">{describirAccion(vista.accion, nombre)}</span>
        </p>
        <AvisoEspecial />
        <Button variant="danger" disabled={pendiente} onClick={() => enviar({ tipo: 'desafiar' })}>
          Desafiar (¿miente?)
        </Button>
        {pasar}
      </div>
    )
  }

  return (
    <div className="space-y-2 animate-entrada">
      <p className="text-center">
        {nombre(vista.bloqueador)} bloquea como{' '}
        <EtiquetaRol rol={vista.reclamo.rol} especial={vista.reclamo.especial} tamano={24} />
        <br />
        <span className="text-sm text-slate-400">{describirAccion(vista.accion, nombre)}</span>
      </p>
      {vista.reclamo.especial && <AvisoEspecial />}
      <Button variant="danger" disabled={pendiente} onClick={() => enviar({ tipo: 'desafiar' })}>
        Desafiar el bloqueo
      </Button>
      {pasar}
    </div>
  )
}
