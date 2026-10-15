/** Short maturity label: 9d, 3m, 1.3y. */
export function maturityLabel(t: number): string {
  const days = Math.round(t * 365)
  if (days < 60) return `${days}d`
  if (days < 548) return `${Math.round(days / 30.4)}m`
  return `${t.toFixed(1)}y`
}

const shortDate = new Intl.DateTimeFormat('en-US', {
  month: 'short',
  day: 'numeric',
  year: 'numeric',
})

export function expiryLabel(isoDate: string): string {
  return shortDate.format(new Date(`${isoDate}T12:00:00Z`))
}
