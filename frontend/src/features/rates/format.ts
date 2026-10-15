/** Money in the notional's currency units, compact above a million. */
export function money(value: number | null | undefined): string {
  if (value == null || !Number.isFinite(value)) return '—'
  const sign = value < 0 ? '−' : ''
  const abs = Math.abs(value)
  if (abs >= 1e6) return `${sign}${(abs / 1e6).toFixed(2)}M`
  return `${sign}${abs.toLocaleString('en-US', { maximumFractionDigits: 0 })}`
}
