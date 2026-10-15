import { ArrowRightIcon } from 'lucide-react'
import { type ReactNode, useEffect, useState } from 'react'
import { Link } from 'react-router'
import { Button } from '@/components/ui/button'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import type { RegionGuide } from '@/content/guides'
import { AnnotatedScreen } from './annotated-screen'

/** The layout every page shares, explained on the vanilla pricer. */
const LAYOUT: RegionGuide[] = [
  {
    key: 'panel',
    label: 'Inputs on the left',
    what: 'Everything you can change, grouped into small sections (contract, market, model, numerics).',
    read: [
      'Drag a slider for intuition or type in the box for an exact value; both edit the same number.',
      'Segmented buttons (Call | Put) pick one option among a few.',
      'Results update by themselves about a fifth of a second after you stop changing things; there is no “calculate” button.',
    ],
  },
  {
    key: 'hero',
    label: 'The headline result',
    what: 'The page’s main answer in large type, with a line saying how it was computed, and smaller tiles with related numbers.',
    read: [
      'Read this first; the charts explain where it comes from.',
      'Small grey text under each number gives its unit or meaning; ⓘ icons explain a term on hover.',
    ],
  },
  {
    key: 'Value across spot',
    label: 'Charts',
    what: 'Each chart has a title saying what it shows and a sentence explaining what to look for.',
    read: [
      'Hover anywhere on a chart for exact values at that point.',
      'Open “How to read this chart” under the title for axes, patterns and something to try.',
    ],
  },
  {
    key: 'Same option, five methods',
    label: 'Tables',
    what: 'Tables give exact numbers when a chart would be too coarse, e.g. comparing methods.',
    read: [
      'A green “Priced” status means the method ran; other statuses explain why it could not.',
    ],
  },
  {
    key: 'Grid and tree convergence',
    label: 'Deeper material lower down',
    what: 'Pages go from the answer at the top to how reliable it is further down.',
    read: ['You can skip the lower sections at first and come back to them.'],
  },
]

const UNITS: [string, string, string][] = [
  [
    'Option prices',
    'Per unit of underlying',
    'With spot 100, 10.45 is about 10% of the stock price.',
  ],
  ['Notes and structured products', '% of notional', '99.89% means 99.89 for every 100 invested.'],
  ['Rates, volatilities, yields', '% a year', 'Continuously compounded unless stated.'],
  ['Basis points (bp)', '0.01%', '115bp = 1.15%. Used for spreads and small rate moves.'],
  ['Volatility points', '1% of volatility', '20% → 21% is +1 vol point. Vega is per vol point.'],
  ['Time', 'Years', '0.25 = three months. Theta is per calendar day.'],
  [
    'Currency amounts',
    'K = thousand, M = million',
    'On pages with a notional (swaps, credit, risk).',
  ],
]

const CHART_CONVENTIONS: [string, string][] = [
  [
    'Lines and legends',
    'Each colour is one series, named in the legend above the chart. Text is always in grey or black; colours only mark lines and areas.',
  ],
  [
    'Dashed vertical line',
    'Your current input (e.g. today’s volatility or the strike), so you can see where you are on the curve.',
  ],
  [
    'Dots on a line',
    'Specific points: today’s spot, breakevens, bootstrapped curve nodes, or the points actually computed.',
  ],
  [
    'Shaded bands',
    'A range: a 95% interval around a Monte Carlo estimate, or the middle 50% / 90% of simulated paths.',
  ],
  [
    'Histograms',
    'Bars counting simulated outcomes, as a share of all paths. Tall bars are likely outcomes, long thin tails rare but large ones.',
  ],
  [
    'Heatmaps',
    'A grid coloured by profit (blue) or loss (red), grey near zero. Read rows and columns like a table; hover a cell for its value.',
  ],
  [
    'Log scales',
    'Axes where each step multiplies (1, 10, 100). Straight lines on them mean power laws, e.g. errors halving every time the work quadruples.',
  ],
  ['3D surfaces', 'Drag to rotate. Each slice is an ordinary chart (a smile, a term structure).'],
  ['Faded charts', 'A new result is being computed; the old one stays visible until it arrives.'],
]

function Section({ id, title, children }: { id: string; title: string; children: ReactNode }) {
  return (
    <section id={id} className="scroll-mt-20 border-t pt-10">
      <h2 className="mb-4 font-semibold text-xl tracking-tight">{title}</h2>
      {children}
    </section>
  )
}

export default function StartPage() {
  const [active, setActive] = useState<number | null>(null)
  useEffect(() => {
    window.scrollTo(0, 0)
  }, [])
  return (
    <div className="flex max-w-6xl flex-col gap-10">
      <div>
        <Link to="/learn" className="text-muted-foreground text-sm hover:text-foreground">
          ← All chapters
        </Link>
        <h1 className="mt-3 font-semibold text-3xl tracking-tight">
          Start here: how to use the lab
        </h1>
        <p className="mt-2 max-w-3xl text-muted-foreground">
          Every page in the lab follows the same pattern, uses the same units and draws charts the
          same way. Ten minutes here make every later page easier to read.
        </p>
      </div>

      <Section id="layout" title="1. One layout everywhere">
        <p className="mb-6 max-w-3xl text-muted-foreground">
          This is the first page, the vanilla option pricer. Hover the numbers.
        </p>
        <div className="grid gap-6 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)]">
          <div className="lg:sticky lg:top-20 lg:self-start">
            <AnnotatedScreen
              screenId="vanilla-pricer"
              regions={LAYOUT}
              active={active}
              onActive={setActive}
              alt="The vanilla pricer with its layout regions numbered"
            />
          </div>
          <ol className="flex flex-col gap-3">
            {LAYOUT.map((r, i) => (
              <li
                key={r.key}
                id={`vanilla-pricer-${i}`}
                onMouseEnter={() => setActive(i)}
                onMouseLeave={() => setActive(null)}
                className="rounded-xl border p-4 text-sm"
              >
                <p className="mb-1.5 font-semibold">
                  {i + 1}. {r.label}
                </p>
                <p>{r.what}</p>
                <ul className="mt-2 list-disc space-y-1 ps-5 text-muted-foreground">
                  {r.read.map((line) => (
                    <li key={line}>{line}</li>
                  ))}
                </ul>
              </li>
            ))}
          </ol>
        </div>
        <p className="mt-6 max-w-3xl text-muted-foreground text-sm">
          Above every page: the area tabs (Vanilla, Volatility, …), the pages of the current area,
          and a “Learn this area” link to the matching chapter. Top right, a green dot shows the
          pricing engine is connected, and the moon/sun switches dark mode.
        </p>
      </Section>

      <Section id="units" title="2. Reading the numbers">
        <div className="overflow-x-auto rounded-xl border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="ps-4">Quantity</TableHead>
                <TableHead>Unit</TableHead>
                <TableHead className="pe-4">Example</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {UNITS.map(([q, u, e]) => (
                <TableRow key={q}>
                  <TableCell className="ps-4 font-medium">{q}</TableCell>
                  <TableCell>{u}</TableCell>
                  <TableCell className="pe-4 whitespace-normal text-muted-foreground">
                    {e}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
        <p className="mt-4 max-w-3xl text-muted-foreground text-sm">
          Signs follow the holder: + means you gain, − you lose. “Short” or a negative quantity
          means you sold the contract.
        </p>
      </Section>

      <Section id="charts" title="3. Reading the charts">
        <dl className="grid gap-4 md:grid-cols-2">
          {CHART_CONVENTIONS.map(([name, text]) => (
            <div key={name} className="rounded-xl border p-4">
              <dt className="font-semibold text-sm">{name}</dt>
              <dd className="mt-1 text-muted-foreground text-sm">{text}</dd>
            </div>
          ))}
        </dl>
        <p className="mt-4 max-w-3xl text-muted-foreground text-sm">
          Under every chart title, “How to read this chart” opens a short explanation of that
          specific chart.
        </p>
      </Section>

      <Section id="randomness" title="4. Simulated results">
        <div className="max-w-3xl space-y-3 text-muted-foreground">
          <p>
            Many results come from Monte Carlo: thousands of random price paths. They come with an
            uncertainty, shown as “± 0.0375” or a 95% interval: the exact answer lies within that
            range about 95% of the time. More paths shrink it, but slowly: four times the paths for
            half the width.
          </p>
          <p>
            The random numbers are fixed (a seed), so the same inputs always give the same result,
            and small input changes move results smoothly rather than jumping with fresh noise.
          </p>
        </div>
      </Section>

      <Section id="caveats" title="5. What the numbers are not">
        <ul className="max-w-3xl list-disc space-y-2 ps-5 text-muted-foreground">
          <li>
            <span className="font-medium text-foreground">
              Probabilities are for pricing, not forecasts.
            </span>{' '}
            “7.7% chance of a capital loss” is a risk-neutral probability: it includes how much the
            market dislikes risk, so it overstates bad outcomes compared with what really happens.
          </li>
          <li>
            <span className="font-medium text-foreground">Most data is illustrative.</span> Rates
            and credit quotes are realistic samples, synthetic data is labelled as such; only the
            SPY snapshot and the Live source are real market prices.
          </li>
          <li>
            <span className="font-medium text-foreground">Every price assumes a model.</span> When
            two models disagree (the Cliquets page shows this best), the difference is model risk,
            not a bug.
          </li>
          <li>Educational tool: nothing here is investment advice.</li>
        </ul>
      </Section>

      <Section id="route" title="6. How to go through the course">
        <ol className="max-w-3xl list-decimal space-y-2 ps-5 text-muted-foreground">
          <li>Take the chapters in order: each builds on the previous ones.</li>
          <li>
            In each chapter, start with{' '}
            <span className="font-medium text-foreground">Using the pages</span>: open each page
            beside the tour and find every numbered region.
          </li>
          <li>Run the experiments at the end of the tour.</li>
          <li>
            Then read <span className="font-medium text-foreground">Theory</span> for why things
            behave as they do.
          </li>
          <li>Look up any unfamiliar word in the glossary.</li>
        </ol>
        <div className="mt-6 flex flex-wrap gap-3">
          <Button render={<Link to="/learn/01-vanilla-options" />}>
            Chapter 1: Vanilla options <ArrowRightIcon />
          </Button>
          <Button variant="outline" render={<Link to="/learn/glossary" />}>
            Glossary
          </Button>
        </div>
      </Section>
    </div>
  )
}
