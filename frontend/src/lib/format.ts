const cache = new Map<string, Intl.NumberFormat>()

function formatter(options: Intl.NumberFormatOptions): Intl.NumberFormat {
  const key = JSON.stringify(options)
  let f = cache.get(key)
  if (!f) {
    f = new Intl.NumberFormat('en-US', options)
    cache.set(key, f)
  }
  return f
}

export function fixed(value: number | null | undefined, digits = 4): string {
  if (value == null || !Number.isFinite(value)) return '—'
  return formatter({ minimumFractionDigits: digits, maximumFractionDigits: digits }).format(value)
}

export function signed(value: number | null | undefined, digits = 4): string {
  if (value == null || !Number.isFinite(value)) return '—'
  return formatter({
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
    signDisplay: 'exceptZero',
  }).format(value)
}

export function compact(value: number): string {
  return formatter({ notation: 'compact', maximumFractionDigits: 1 }).format(value)
}

export function integer(value: number): string {
  return formatter({ maximumFractionDigits: 0 }).format(value)
}

export function scientific(value: number | null | undefined): string {
  if (value == null || !Number.isFinite(value)) return '—'
  if (value === 0) return '0'
  return value.toExponential(1)
}

export function milliseconds(value: number | null | undefined): string {
  if (value == null) return '—'
  return value < 1 ? '<1 ms' : `${formatter({ maximumFractionDigits: 0 }).format(value)} ms`
}
/** Money in the notional's currency units, compact above a million. */
export function money(value: number | null | undefined): string {
  if (value == null || !Number.isFinite(value)) return '—'
  const sign = value < 0 ? '−' : ''
  const abs = Math.abs(value)
  if (abs >= 1e6) return `${sign}${(abs / 1e6).toFixed(2)}M`
  return `${sign}${abs.toLocaleString('en-US', { maximumFractionDigits: 0 })}`
}
