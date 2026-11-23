import { rolesVisibles, seccionesReglas, tablaAcciones } from '../reglasContenido'
import { IconoRol } from '../iconos/IconoRol'
import { uiCarta } from '../rolesUI'

/**
 * Contenido de las reglas, compartido por la Guía rápida (en partida) y las
 * Reglas (pantalla principal y sala de espera). Todo sale de `reglasContenido`,
 * así que nunca difiere del motor ni entre pantallas.
 */

/** Las acciones del modo: coste, qué hacen, qué carta exigen y quién puede bloquearlas. */
export function TarjetasAcciones({ especiales }: { especiales: boolean }) {
  return (
    <ul className="space-y-3">
      {tablaAcciones(especiales).map((f) => (
        <li key={f.tipo} className="rounded-2xl border border-slate-700 bg-slate-950/60 p-3">
          <div className="flex items-baseline justify-between gap-2">
            <h3 className="font-bold">{f.titulo}</h3>
            <span className="shrink-0 rounded-full bg-amber-400/15 px-2 py-0.5 text-sm font-bold text-amber-300">
              {f.coste > 0 ? `◈ ${f.coste}` : 'Gratis'}
            </span>
          </div>
          <p className="mt-1 text-sm text-slate-100">{f.efecto}</p>
          <dl className="mt-2 space-y-0.5 text-sm text-slate-300">
            <div className="flex flex-wrap gap-x-1">
              <dt className="font-semibold text-slate-200">Requiere:</dt>
              <dd>{f.requiere ?? 'ninguna carta (cualquiera puede hacerla)'}</dd>
            </div>
            <div className="flex flex-wrap gap-x-1">
              <dt className="font-semibold text-slate-200">Se bloquea:</dt>
              <dd>{f.bloqueablePor ?? 'no se puede bloquear'}</dd>
            </div>
          </dl>
        </li>
      ))}
    </ul>
  )
}

/** Qué hace cada rol y, si hay cartas especiales, su habilidad extra. */
export function FichasRoles({ especiales }: { especiales: boolean }) {
  return (
    <ul className="space-y-3">
      {rolesVisibles(especiales).map((r) => {
        const ui = uiCarta(r.rol)
        return (
          <li key={r.rol} className={`rounded-2xl border-2 bg-gradient-to-b p-3 ${ui.borde} ${ui.fondo}`}>
            <div className="flex items-center gap-2">
              <IconoRol rol={r.rol} tamano={40} decorativo />
              <h3 className="text-lg font-bold">{r.nombre}</h3>
            </div>
            <p className="mt-1 text-sm text-slate-100">{r.resumen}</p>
            {r.especial && (
              <p className="mt-2 rounded-lg border border-yellow-300/50 bg-yellow-950/40 p-2 text-sm text-slate-100">
                <span className="font-semibold text-yellow-200">✨ Carta especial: </span>
                {r.especial.descripcion}
              </p>
            )}
          </li>
        )
      })}
    </ul>
  )
}

/** El reglamento por secciones (objetivo, turno, desafíos, bloqueos…). */
export function SeccionesReglas({ especiales }: { especiales: boolean }) {
  return (
    <div className="space-y-5">
      {seccionesReglas(especiales).map((s) => (
        <section key={s.id}>
          <h3 className="text-lg font-bold text-cyan-300">{s.titulo}</h3>
          <ul className="mt-1 list-disc space-y-1 pl-5 text-sm text-slate-100">
            {s.puntos.map((punto, i) => (
              <li key={i}>{punto}</li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  )
}
