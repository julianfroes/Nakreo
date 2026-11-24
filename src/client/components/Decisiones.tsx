import { useState } from 'react'
import type { EstadoProyectado } from '../../game/proyeccion'
import { nombreReclamo } from '../../game/roles'
import type { Carta, CartaEnMano } from '../../game/types'
import { Button } from '../../shared/components/Button'
import type { IntencionCliente } from '../../shared/protocolo'
import { IconoRol } from '../../shared/iconos/IconoRol'
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
  p, pendiente, enviar, reclamo, desafiante, accion, puedeSalvarse,
}: Comun & Extract<Vista, { tipo: 'defenderse' }>) {
  const vivas = p.yo.mano.filter((c) => !c.revelada)
  const [sel, setSel] = useSeleccion(vivas)
  const nombre = (id: string) => nombreDe(p, id)

  return (
    <Overlay
      alerta
      titulo={`¡${nombre(desafiante)} te desafía!`}
      subtitulo={`${describirAccion(accion, nombre)} — debes probar que eres ${nombreReclamo(reclamo)}`}
    >
      <p className="text-center text-sm text-slate-300">Elige una carta:</p>
      <div className="flex gap-3">
        {vivas.map((c) => (
          <CartaRol key={c.id} id={c.id} rol={c.rol} especial={c.especial} seleccionada={sel === c.id} onClick={() => setSel(c.id)} />
        ))}
      </div>
      <Button disabled={sel === null || pendiente} onClick={() => enviar({ tipo: 'revelarCarta', cartaId: sel! })}>
        Mostrar carta
      </Button>
      <p className="-mt-2 text-center text-xs text-slate-400">
        Si no es {nombreReclamo(reclamo)}, la pierdes
        {reclamo.especial ? ' (y también la otra)' : ''}. Si lo es, quien te desafió pierde{' '}
        {reclamo.especial ? '2 cartas' : 'una carta'}.
      </p>
      {puedeSalvarse && (
        <>
          <Button variant="secondary" disabled={pendiente} onClick={() => enviar({ tipo: 'salvarse' })}>
            <span className="inline-flex items-center justify-center gap-2">
              <IconoRol rol="jefeArea" especial tamano={24} decorativo />
              Excusa de mérito: tengo el Jefe de Área Especial (salvarme)
            </span>
          </Button>
          <p className="-mt-2 text-center text-xs text-slate-400">
            Un solo uso, sin mostrar carta: si nadie te desafía no pierdes cartas (tu acción sí se
            cancela). Si te desafían y no la tienes, pierdes todo.
          </p>
        </>
      )}
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
          <CartaRol key={c.id} id={c.id} rol={c.rol} especial={c.especial} seleccionada={sel === c.id} onClick={() => setSel(c.id)} />
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
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {opciones.map((c) => (
          <CartaRol key={c.id} id={c.id} rol={c.rol} especial={c.especial} seleccionada={elegidas.includes(c.id)} onClick={() => alternar(c.id)} />
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
