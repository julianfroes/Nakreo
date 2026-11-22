import { useState } from 'react'
import type { EstadoProyectado } from '../../game/proyeccion'
import type { Carta, CartaEnMano, Rol } from '../../game/types'
import { Button } from '../../shared/components/Button'
import type { IntencionCliente } from '../../shared/protocolo'
import { ROL_UI } from '../../shared/rolesUI'
import { describirAccion } from '../../shared/textos'
import { nombreDe, type Vista } from '../vista'
import { CartaRol } from './CartaRol'
import { Overlay } from './Overlay'

interface Comun {
  p: EstadoProyectado
  pendiente: boolean
  enviar: (i: IntencionCliente) => void
}

/** Cartas vivas de mi mano; si solo hay una, queda preseleccionada. */
function useSeleccion(vivas: CartaEnMano[]) {
  const [id, setId] = useState<number | null>(vivas.length === 1 ? vivas[0].id : null)
  return [id, setId] as const
}

/** Me desafían: "Mostrar carta" (probar que tengo el rol) o "Rendirme". */
export function ModalDefensa({
  p, pendiente, enviar, rol, desafiante, accion,
}: Comun & Extract<Vista, { tipo: 'defenderse' }>) {
  const vivas = p.yo.mano.filter((c) => !c.revelada)
  const [sel, setSel] = useSeleccion(vivas)
  const nombre = (id: string) => nombreDe(p, id)

  return (
    <Overlay
      alerta
      titulo={`¡${nombre(desafiante)} te desafía!`}
      subtitulo={`${describirAccion(accion, nombre)} — debes probar que eres ${ROL_UI[rol].icono} ${ROL_UI[rol].nombre}`}
    >
      <p className="text-center text-sm text-slate-300">Elige una carta:</p>
      <div className="flex gap-3">
        {vivas.map((c) => (
          <CartaRol key={c.id} rol={c.rol} seleccionada={sel === c.id} onClick={() => setSel(c.id)} />
        ))}
      </div>
      <Button disabled={sel === null || pendiente} onClick={() => enviar({ tipo: 'revelarCarta', cartaId: sel! })}>
        Mostrar carta
      </Button>
      <p className="-mt-2 text-center text-xs text-slate-400">
        Si no es {ROL_UI[rol].nombre}, la pierdes. Si lo es, quien te desafió pierde una carta.
      </p>
      <Button variant="danger" disabled={sel === null || pendiente} onClick={() => enviar({ tipo: 'rendirse', cartaId: sel! })}>
        Rendirme (pierdo la carta elegida)
      </Button>
      {pendiente && <p className="text-center text-slate-400">Esperando al anfitrión…</p>}
    </Overlay>
  )
}

/** Debo perder una carta: elijo cuál. */
export function ElegirCartaAPerder({ p, pendiente, enviar }: Comun) {
  const vivas = p.yo.mano.filter((c) => !c.revelada)
  const [sel, setSel] = useSeleccion(vivas)
  return (
    <Overlay alerta titulo="Pierdes una carta" subtitulo="Elige cuál sacrificar">
      <div className="flex gap-3">
        {vivas.map((c) => (
          <CartaRol key={c.id} rol={c.rol} seleccionada={sel === c.id} onClick={() => setSel(c.id)} />
        ))}
      </div>
      <Button variant="danger" disabled={sel === null || pendiente} onClick={() => enviar({ tipo: 'elegirCartaAPerder', cartaId: sel! })}>
        Perder esta carta
      </Button>
    </Overlay>
  )
}

/** Ingeniero: conservo `cuantas` cartas entre las mías y las robadas. */
export function Reasignacion({
  pendiente, enviar, opciones, cuantas,
}: Pick<Comun, 'pendiente' | 'enviar'> & { opciones: (Carta | CartaEnMano)[]; cuantas: number }) {
  const [elegidas, setElegidas] = useState<number[]>([])
  const alternar = (id: number) =>
    setElegidas((e) => (e.includes(id) ? e.filter((x) => x !== id) : e.length < cuantas ? [...e, id] : e))

  return (
    <Overlay titulo="Reasignación" subtitulo={`Conserva ${cuantas} carta${cuantas > 1 ? 's' : ''}; el resto vuelve al mazo`}>
      <div className="grid grid-cols-2 gap-3">
        {opciones.map((c: { id: number; rol: Rol }) => (
          <CartaRol key={c.id} rol={c.rol} seleccionada={elegidas.includes(c.id)} onClick={() => alternar(c.id)} />
        ))}
      </div>
      <Button
        disabled={elegidas.length !== cuantas || pendiente}
        onClick={() => enviar({ tipo: 'confirmarReasignacion', conservar: elegidas })}
      >
        Confirmar ({elegidas.length}/{cuantas})
      </Button>
    </Overlay>
  )
}
