import type { EstadoProyectado } from '../../game/proyeccion'
import { ACCIONES } from '../../game/roles'
import { Button } from '../../shared/components/Button'
import { ROL_UI } from '../../shared/rolesUI'
import { describirAccion } from '../../shared/textos'
import { nombreDe, type Vista } from '../vista'
import type { IntencionCliente } from '../../shared/protocolo'

type VistaRespuesta = Extract<
  Vista,
  { tipo: 'responderDesafio' | 'responderBloqueo' | 'responderDesafioBloqueo' }
>

interface Props {
  p: EstadoProyectado
  vista: VistaRespuesta
  pendiente: boolean
  enviar: (i: IntencionCliente) => void
}

/** Ventanas de respuesta: desafiar, bloquear o dejar pasar. */
export function PanelRespuesta({ p, vista, pendiente, enviar }: Props) {
  const nombre = (id: string) => nombreDe(p, id)
  const pasar = (
    <Button variant="secondary" disabled={pendiente} onClick={() => enviar({ tipo: 'pasar' })}>
      Dejar pasar
    </Button>
  )

  if (vista.tipo === 'responderDesafio') {
    const rol = ACCIONES[vista.accion.tipo].rolRequerido!
    return (
      <div className="space-y-2 animate-entrada">
        <p className="text-center">
          {describirAccion(vista.accion, nombre)}
          <br />
          <span className="text-sm text-slate-400">
            Afirma ser {ROL_UI[rol].icono} {ROL_UI[rol].nombre}
          </span>
        </p>
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
        {vista.roles.map((rol) => (
          <Button
            key={rol}
            disabled={pendiente}
            onClick={() => enviar({ tipo: 'bloquear', rol })}
          >
            Bloquear como {ROL_UI[rol].icono} {ROL_UI[rol].nombre}
          </Button>
        ))}
        {pasar}
      </div>
    )
  }

  return (
    <div className="space-y-2 animate-entrada">
      <p className="text-center">
        {nombre(vista.bloqueador)} bloquea como {ROL_UI[vista.rol].icono} {ROL_UI[vista.rol].nombre}
        <br />
        <span className="text-sm text-slate-400">{describirAccion(vista.accion, nombre)}</span>
      </p>
      <Button variant="danger" disabled={pendiente} onClick={() => enviar({ tipo: 'desafiar' })}>
        Desafiar el bloqueo
      </Button>
      {pasar}
    </div>
  )
}
