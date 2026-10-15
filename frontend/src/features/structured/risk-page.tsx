import { ChartGuide } from '@/components/chart-guide'
import { keepPreviousData, useQuery } from '@tanstack/react-query'
import { AlertTriangleIcon, PlusIcon, XIcon } from 'lucide-react'
import { useMemo, useState } from 'react'
import { ChartCard } from '@/components/charts/chart-card'
import { EChart, type ChartOption } from '@/components/charts/echart'
import {
  axisStyle,
  FONT_FAMILY,
  tooltipHeader,
  tooltipRow,
  tooltipStyle,
  useChartColors,
} from '@/components/charts/theme'
import { NumberInput } from '@/components/number-input'
import { PageHeader } from '@/components/page-header'
import { PanelSection } from '@/components/panel-section'
import { ParamControl } from '@/components/param-control'
import { Stat, StatGrid } from '@/components/stat-grid'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Card, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Select, SelectItem, SelectPopup, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Separator } from '@/components/ui/separator'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { useDebouncedValue } from '@/hooks/use-debounced-value'
import { api, type PositionIn, type RiskProduct, type RiskResponse } from '@/lib/api'
import { fixed, integer, money } from '@/lib/format'
import { cn } from '@/lib/utils'
import { DEFAULT_MARKET, MarketSection, type MarketParams, toMarket } from './market-section'

const SPOT = 100

const PRODUCTS: { value: RiskProduct; label: string }[] = [
  { value: 'call', label: 'Call' },
  { value: 'put', label: 'Put' },
  { value: 'digital_call', label: 'Digital call (pays 1)' },
  { value: 'digital_put', label: 'Digital put (pays 1)' },
  { value: 'down_in_put', label: 'Down-and-in put' },
  { value: 'up_out_call', label: 'Up-and-out call' },
  { value: 'reverse_convertible', label: 'Reverse convertible' },
  { value: 'autocallable', label: 'Autocallable' },
]
const LABEL = Object.fromEntries(PRODUCTS.map((p) => [p.value, p.label])) as Record<
  RiskProduct,
  string
>
const NOTES: RiskProduct[] = ['reverse_convertible', 'autocallable']
const BARRIERS: RiskProduct[] = [
  'down_in_put',
  'up_out_call',
  'reverse_convertible',
  'autocallable',
]

function position(
  product: RiskProduct,
  quantity: number,
  extra: Partial<PositionIn> = {},
): PositionIn {
  const barrier =
    product === 'up_out_call'
      ? 130
      : product === 'down_in_put'
        ? 75
        : product === 'autocallable'
          ? 60
          : product === 'reverse_convertible'
            ? 70
            : null
  return {
    product,
    strike: 100,
    barrier,
    expiry: product === 'autocallable' ? 3 : 1,
    quantity,
    coupon: 0.08,
    label: '',
    ...extra,
  }
}

const PRESETS: { name: string; positions: PositionIn[] }[] = [
  {
    name: 'Note issuer',
    positions: [
      position('autocallable', -1_000_000, { coupon: 0.08 }),
      position('reverse_convertible', -1_000_000, { coupon: 0.1 }),
      position('put', 8_000, { strike: 80 }),
    ],
  },
  {
    name: 'Market maker',
    positions: [
      position('call', 5_000),
      position('call', -5_000, { strike: 110 }),
      position('digital_put', -20_000, { strike: 90 }),
      position('down_in_put', 3_000, { barrier: 80 }),
    ],
  },
  {
    name: 'Barrier book',
    positions: [
      position('up_out_call', 10_000, { barrier: 125 }),
      position('call', -6_000, { strike: 110 }),
    ],
  },
]

function PositionEditor({
  value,
  index,
  onChange,
  onRemove,
}: {
  value: PositionIn
  index: number
  onChange: (p: PositionIn) => void
  onRemove: () => void
}) {
  const note = NOTES.includes(value.product)
  const set =
    <K extends keyof PositionIn>(key: K) =>
    (v: PositionIn[K]) =>
      onChange({ ...value, [key]: v })
  return (
    <fieldset className="flex flex-col gap-3 rounded-xl border p-3">
      <legend className="sr-only">Position {index + 1}</legend>
      <div className="flex items-center gap-2">
        <Select
          items={PRODUCTS}
          value={value.product}
          onValueChange={(v) => v && onChange(position(v as RiskProduct, value.quantity))}
        >
          <SelectTrigger size="sm" aria-label={`Position ${index + 1} product`}>
            <SelectValue />
          </SelectTrigger>
          <SelectPopup>
            {PRODUCTS.map((p) => (
              <SelectItem key={p.value} value={p.value}>
                {p.label}
              </SelectItem>
            ))}
          </SelectPopup>
        </Select>
        <Button
          variant="ghost"
          size="icon-sm"
          onClick={onRemove}
          aria-label={`Remove position ${index + 1}`}
        >
          <XIcon />
        </Button>
      </div>
      <div className="grid grid-cols-3 gap-2">
        <div className="col-span-2">
          <NumberInput
            label={note ? 'Notional' : 'Quantity'}
            value={value.quantity}
            onChange={set('quantity')}
            min={-1e8}
            max={1e8}
            step={note ? 100_000 : 1_000}
          />
        </div>
        <NumberInput
          label="Years"
          value={value.expiry}
          onChange={set('expiry')}
          min={0.25}
          max={value.product === 'autocallable' ? 7 : 5}
          step={0.25}
          digits={2}
        />
        <NumberInput
          label={note ? 'Strike %' : 'Strike'}
          value={value.strike}
          onChange={set('strike')}
          min={10}
          max={300}
          step={5}
        />
        {BARRIERS.includes(value.product) && (
          <NumberInput
            label={note ? 'Barrier %' : 'Barrier'}
            value={value.barrier ?? 70}
            onChange={set('barrier')}
            min={10}
            max={300}
            step={5}
          />
        )}
        {note && (
          <NumberInput
            label="Coupon"
            value={value.coupon * 100}
            onChange={(v) => set('coupon')(v / 100)}
            min={0}
            max={30}
            step={0.5}
            digits={1}
            unit="%"
          />
        )}
      </div>
    </fieldset>
  )
}

function StressHeatmap({ data, stale }: { data?: RiskResponse; stale: boolean }) {
  const c = useChartColors()
  const option = useMemo<ChartOption | null>(() => {
    if (!data) return null
    const axis = axisStyle(c)
    const cells = data.grid.flatMap((row, i) => row.map((v, j) => [j, i, v]))
    const extreme = Math.max(1e-9, ...cells.map((cell) => Math.abs(cell[2])))
    const spotLabel = (s: number) =>
      s === 0 ? 'Today' : `${s > 0 ? '+' : '−'}${fixed(Math.abs(s) * 100, 0)}%`
    const volLabel = (v: number) =>
      v === 0 ? 'Today’s vol' : `${v > 0 ? '+' : '−'}${fixed(Math.abs(v) * 100, 0)} pts`
    return {
      animation: false,
      grid: { left: 8, right: 16, top: 16, bottom: 56, containLabel: true },
      tooltip: {
        ...tooltipStyle(c),
        trigger: 'item',
        formatter: (raw: unknown) => {
          const [j, i, v] = (raw as { value: number[] }).value
          return (
            tooltipHeader(
              `Spot ${spotLabel(data.spot_shifts[j])} · ${volLabel(data.vol_shifts[i])}`,
            ) + tooltipRow(v >= 0 ? c.diverging[4] : c.diverging[0], money(v), 'Book P&L')
          )
        },
      },
      xAxis: {
        type: 'category',
        data: data.spot_shifts.map(spotLabel),
        name: 'Spot move',
        nameLocation: 'middle',
        nameGap: 28,
        ...axis,
        splitLine: { show: false },
      },
      yAxis: {
        type: 'category',
        data: data.vol_shifts.map(volLabel),
        ...axis,
        splitLine: { show: false },
      },
      visualMap: {
        type: 'continuous',
        min: -extreme,
        max: extreme,
        calculable: false,
        orient: 'horizontal',
        left: 'center',
        bottom: 0,
        itemWidth: 10,
        itemHeight: 160,
        text: ['Profit', 'Loss'],
        textStyle: { color: c.muted, fontFamily: FONT_FAMILY, fontSize: 11 },
        inRange: { color: [...c.diverging] },
      },
      series: [
        {
          name: 'P&L',
          type: 'heatmap',
          data: cells,
          itemStyle: { borderColor: c.surface, borderWidth: 1 },
          emphasis: { itemStyle: { borderColor: c.ink, borderWidth: 1 } },
        },
      ],
    }
  }, [data, c])
  return (
    <ChartCard
      title="Stress grid: book P&L by spot and volatility"
      description="Every cell revalues every position in full: closed forms, Fourier and Monte Carlo alike. Notes keep today’s level as their initial fixing, so a spot move is a move in their performance. Blue is profit, red is loss; hover a cell for its value."
      stale={stale}
    >
      {option ? (
        <EChart
          option={option}
          className="h-96"
          ariaLabel="Heatmap of book profit and loss across spot and volatility shocks"
        />
      ) : (
        <div className="h-96" />
      )}
    </ChartCard>
  )
}

export default function RiskPage() {
  const [positions, setPositions] = useState<PositionIn[]>(PRESETS[0].positions)
  const [volPct, setVolPct] = useState(25)
  const [market, setMarket] = useState<MarketParams>(DEFAULT_MARKET)
  // One stable object per change, so the debounce settles instead of re-rendering forever.
  const inputs = useMemo(() => ({ positions, volPct, market }), [positions, volPct, market])
  const settled = useDebouncedValue(inputs, 250)
  const request = useMemo(
    () => ({
      ...toMarket(settled.market),
      volatility: settled.volPct / 100,
      positions: settled.positions.map((p) => ({ ...p, label: p.label || LABEL[p.product] })),
    }),
    [settled],
  )
  const query = useQuery({
    queryKey: ['structured', 'risk', request],
    queryFn: ({ signal }) => api.portfolioRisk(request, signal),
    placeholderData: keepPreviousData,
    enabled: positions.length > 0,
  })
  const data = positions.length ? query.data : undefined
  const stale = query.isPlaceholderData
  const t = data?.total
  const onePct = SPOT * 0.01

  return (
    <>
      <PageHeader title="Portfolio risk and stress testing">
        A book mixing options, barriers and structured notes, risk-managed as one. Greeks are
        aggregated by revaluing everything with bumped inputs, and stress scenarios show where the
        second-order Greek picture breaks down.
      </PageHeader>
      <div className="grid gap-6 lg:grid-cols-[22rem_minmax(0,1fr)]">
        <aside>
          <Card className="overflow-hidden">
            <PanelSection
              title="Positions"
              hint="Negative quantity = short. Notes: notional, with strike and barrier in % of today’s spot (100)."
            >
              <div className="flex flex-wrap gap-2">
                {PRESETS.map((p) => (
                  <Button
                    key={p.name}
                    variant="outline"
                    size="sm"
                    onClick={() => setPositions(p.positions)}
                  >
                    {p.name}
                  </Button>
                ))}
              </div>
              {positions.map((p, i) => (
                <PositionEditor
                  key={i}
                  index={i}
                  value={p}
                  onChange={(next) => setPositions(positions.map((q, j) => (j === i ? next : q)))}
                  onRemove={() => setPositions(positions.filter((_, j) => j !== i))}
                />
              ))}
              <Button
                variant="outline"
                size="sm"
                disabled={positions.length >= 12}
                onClick={() => setPositions([...positions, position('put', 1_000, { strike: 90 })])}
              >
                <PlusIcon /> Add position
              </Button>
            </PanelSection>
            <Separator />
            <PanelSection
              title="Volatility"
              hint="One Black–Scholes volatility for every product, so the stress grid is a clean parallel shift."
            >
              <ParamControl
                label="Volatility"
                value={volPct}
                onChange={setVolPct}
                min={5}
                max={60}
                step={1}
                unit="%"
              />
            </PanelSection>
            <Separator />
            <MarketSection market={market} onChange={setMarket} />
          </Card>
        </aside>
        <div className="flex min-w-0 flex-col gap-6">
          {positions.length === 0 && (
            <Alert>
              <AlertTitle>The book is empty</AlertTitle>
              <AlertDescription>Add a position or load a preset.</AlertDescription>
            </Alert>
          )}
          {query.error && (
            <Alert variant="error">
              <AlertTriangleIcon />
              <AlertTitle>Risk run failed</AlertTitle>
              <AlertDescription>{query.error.message}</AlertDescription>
            </Alert>
          )}
          <Card className={cn('transition-opacity', stale && 'opacity-60')}>
            <CardHeader>
              <CardTitle className="text-base" render={<h2 />}>
                Book Greeks
              </CardTitle>
              <CardDescription>In currency, for the moves a risk manager watches.</CardDescription>
              <ChartGuide heading="Book Greeks" noun="card" />
            </CardHeader>
            <div className="px-6 pb-6">
              <StatGrid className="grid-cols-2 xl:grid-cols-4">
                <Stat
                  label="Delta, per 1% spot move"
                  value={t ? money(t.delta * onePct) : '—'}
                  hint={
                    t
                      ? `Like being ${t.delta < 0 ? 'short' : 'long'} ${integer(Math.abs(t.delta))} shares`
                      : undefined
                  }
                />
                <Stat
                  label="Gamma, P&L from a 1% move"
                  value={t ? money(0.5 * t.gamma * onePct * onePct) : '—'}
                  hint="Convexity: same sign up or down"
                />
                <Stat
                  label="Vega, per vol point"
                  value={t ? money(t.vega) : '—'}
                  hint="All volatilities +1 point"
                />
                <Stat
                  label="Rho, per 1% rates"
                  value={t ? money(t.rho) : '—'}
                  hint="Rates +1 percentage point"
                />
              </StatGrid>
            </div>
          </Card>
          <Card className={cn('transition-opacity', stale && 'opacity-60')}>
            <CardHeader>
              <CardTitle className="text-base" render={<h2 />}>
                Positions
              </CardTitle>
              <CardDescription>
                Values and risks per position; the book is their sum.
              </CardDescription>
              <ChartGuide heading="Positions" noun="table" />
            </CardHeader>
            <div className="overflow-x-auto px-2 pb-2">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="ps-4">Position</TableHead>
                    <TableHead className="text-right">Value</TableHead>
                    <TableHead className="text-right">Delta / 1%</TableHead>
                    <TableHead className="text-right">Vega / pt</TableHead>
                    <TableHead className="pe-4 text-right">Rho / 1%</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {(data ? [...data.positions, data.total] : []).map((p, i, rows) => (
                    <TableRow key={i} className={cn(i === rows.length - 1 && 'font-semibold')}>
                      <TableCell className="ps-4">{p.label}</TableCell>
                      <TableCell className="text-right tabular-nums">{money(p.value)}</TableCell>
                      <TableCell className="text-right tabular-nums">
                        {money(p.delta * onePct)}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">{money(p.vega)}</TableCell>
                      <TableCell className="pe-4 text-right tabular-nums">{money(p.rho)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </Card>
          <StressHeatmap data={data} stale={stale} />
          <Card className={cn('transition-opacity', stale && 'opacity-60')}>
            <CardHeader>
              <CardTitle className="text-base" render={<h2 />}>
                Scenarios: full revaluation against the Greeks
              </CardTitle>
              <CardDescription>
                The Greek estimate is Δ dS + ½ Γ dS² + vega dσ + rho dr. It works for small moves
                and fails for large ones, especially near barriers, which is why risk is stressed by
                full revaluation.
              </CardDescription>
              <ChartGuide heading="Scenarios: full revaluation against the Greeks" noun="table" />
            </CardHeader>
            <div className="overflow-x-auto px-2 pb-2">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="ps-4">Scenario</TableHead>
                    <TableHead className="text-right">Full revaluation</TableHead>
                    <TableHead className="text-right">Greek estimate</TableHead>
                    <TableHead className="pe-4 text-right">Estimate error</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {(data?.scenarios ?? []).map((s) => (
                    <TableRow key={s.name}>
                      <TableCell className="ps-4">{s.name}</TableCell>
                      <TableCell className="text-right tabular-nums">{money(s.full)}</TableCell>
                      <TableCell className="text-right tabular-nums">{money(s.taylor)}</TableCell>
                      <TableCell className="pe-4 text-right text-muted-foreground tabular-nums">
                        {money(s.taylor - s.full)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </Card>
        </div>
      </div>
    </>
  )
}
