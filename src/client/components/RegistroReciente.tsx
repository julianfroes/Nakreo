import type { EstadoProyectado } from '../../game/proyeccion'
import { colorEvento, textoEvento } from '../../shared/textos'
import { nombreDe } from '../vista'

/** Cuántos eventos recientes se muestran. */
const MAXIMO = 14

/**
 * Lo que acaba de pasar en la mesa, para el panel lateral de escritorio (en móvil
 * no hay sitio y solo se ve el último evento). Los más nuevos van arriba. Solo
 * contiene eventos públicos.
 */
export function RegistroReciente({ p }: { p: EstadoProyectado }) {
  const nombre = (id: string) => nombreDe(p, id)
  const total = p.registro.length
  const recientes = p.registro.slice(-MAXIMO).reverse()

  return (
    <section aria-label="Registro" className="border-t border-slate-700 pt-3">
      <h3 className="text-xs font-semibold uppercase tracking-widest text-slate-400">Registro</h3>
      <ol className="mt-2 space-y-1 text-sm" aria-live="polite">
        {recientes.map((e, i) => (
          <li key={total - 1 - i} className={colorEvento(e.tipo)}>
            {textoEvento(e, nombre)}
          </li>
        ))}
      </ol>
    </section>
  )
}
