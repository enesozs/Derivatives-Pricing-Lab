import { Link } from 'react-router'
import { SAMPLE_QUOTES, useCurveQuotes } from './curve-context'

/** One line reminding which curve a page prices on, with a link to edit it. */
export function CurveNote() {
  const { quotes } = useCurveQuotes()
  const edited = quotes !== SAMPLE_QUOTES
  return (
    <p className="text-muted-foreground text-xs">
      Priced on the {edited ? 'edited' : 'illustrative sample'} curve ({quotes.length} quotes,
      single-curve, ACT/365).{' '}
      <Link to="/rates" className="underline underline-offset-2 hover:text-foreground">
        Edit the curve
      </Link>
    </p>
  )
}
