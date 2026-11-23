import type { ComponentProps } from 'react'

type Variant = 'primary' | 'secondary' | 'danger'

const styles: Record<Variant, string> = {
  primary: 'bg-cyan-500 text-slate-950 hover:bg-cyan-400 active:bg-cyan-300',
  secondary: 'bg-slate-800 text-slate-100 hover:bg-slate-700 active:bg-slate-600 border border-slate-600',
  danger: 'bg-rose-600 text-white hover:bg-rose-500 active:bg-rose-400',
}

/** Incluye `ref` (React 19 lo pasa como una propiedad más). */
interface Props extends ComponentProps<'button'> {
  variant?: Variant
}

export function Button({ variant = 'primary', className = '', ...rest }: Props) {
  return (
    <button
      className={`min-h-14 w-full rounded-xl px-6 py-3 text-lg font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-40 ${styles[variant]} ${className}`}
      {...rest}
    />
  )
}
