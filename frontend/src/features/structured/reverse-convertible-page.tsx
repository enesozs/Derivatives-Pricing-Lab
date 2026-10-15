import { keepPreviousData, useQuery } from '@tanstack/react-query'
import { AlertTriangleIcon } from 'lucide-react'
import { useMemo, useState } from 'react'
import { useChartColors } from '@/components/charts/theme'
import {
  DEFAULT_MODEL,
  type ModelParams,
  ModelSection,
  toModelSpec,
} from '@/components/model-section'
import { PageHeader } from '@/components/page-header'
import { PanelSection } from '@/components/panel-section'
import { ParamControl } from '@/components/param-control'
import { Segmented } from '@/components/segmented'
import { Stat, StatGrid } from '@/components/stat-grid'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Card, CardDescription, CardHeader, CardPanel, CardTitle } from '@/components/ui/card'
import { Separator } from '@/components/ui/separator'
import { useDebouncedValue } from '@/hooks/use-debounced-value'
import { api, type ReverseConvertibleRequest } from '@/lib/api'
import { fixed } from '@/lib/format'
import { cn } from '@/lib/utils'
import { type LineSeries, LinesChart } from '@/components/charts/simple-charts'
import { DEFAULT_MARKET, MarketSection, type MarketParams, toMarket } from './market-section'

interface Params {
  maturity: number
  couponPct: number
  frequency: ReverseConvertibleRequest['frequency']
  strikePct: number
  barrier: boolean
  barrierPct: number
}

const DEFAULTS: Params = {
  maturity: 1,
  couponPct: 10,
  frequency: 4,
  strikePct: 100,
  barrier: true,
  barrierPct: 70,
}

const pct = (v: number, digits = 2) => `${fixed(v * 100, digits)}%`

export default function ReverseConvertiblePage() {
  const c = useChartColors()
  const [params, setParams] = useState(DEFAULTS)
  const [model, setModel] = useState<ModelParams>(DEFAULT_MODEL)
  const [market, setMarket] = useState<MarketParams>(DEFAULT_MARKET)
  // One stable object per change, so the debounce settles instead of re-rendering forever.
  const inputs = useMemo(() => ({ params, model, market }), [params, model, market])
  const settled = useDebouncedValue(inputs, 150)
  const request = useMemo<ReverseConvertibleRequest>(() => {
    const p = settled.params
    return {
      ...toMarket(settled.market),
      maturity: p.maturity,
      coupon: p.couponPct / 100,
      frequency: p.frequency,
      strike: p.strikePct / 100,
      barrier: p.barrier ? Math.min(p.barrierPct, p.strikePct) / 100 : null,
      model: toModelSpec(settled.model),
    }
  }, [settled])
  const query = useQuery({
    queryKey: ['structured', 'reverse-convertible', request],
    queryFn: ({ signal }) => api.reverseConvertible(request, signal),
    placeholderData: keepPreviousData,
  })
  const data = query.data
  const stale = query.isPlaceholderData
  const set =
    <K extends keyof Params>(key: K) =>
    (value: Params[K]) =>
      setParams({ ...params, [key]: value })

  const payoff: LineSeries[] = data
    ? (() => {
        const level = (i: number) => data.final_levels[i] * 100
        const total = (r: number) => (r + data.coupon_total) * 100
        const hit: LineSeries = {
          name: request.barrier == null ? 'Redemption + coupons' : 'Barrier touched',
          color: request.barrier == null ? c.series1 : c.series2,
          points: data.redemption_hit.map((r, i) => [level(i), total(r)]),
        }
        if (request.barrier == null) return [hit]
        const safe: LineSeries = {
          name: 'Barrier never touched',
          color: c.series1,
          // Ending below the barrier means it was touched, so this branch starts at the barrier.
          points: data.redemption_not_hit.flatMap((r, i) =>
            data.final_levels[i] >= (request.barrier ?? 0)
              ? [[level(i), total(r)] as [number, number]]
              : [],
          ),
        }
        return [safe, hit]
      })()
    : []

  return (
    <>
      <PageHeader title="Reverse convertibles">
        A note that pays a coupon well above deposit rates. The catch: if the stock falls below the
        strike, you are repaid in shares worth less than you invested. It is a bond plus a put you
        sold, and the coupon is mostly the put premium.
      </PageHeader>
      <div className="grid gap-6 lg:grid-cols-[20rem_minmax(0,1fr)]">
        <aside>
          <Card className="overflow-hidden">
            <PanelSection title="Term sheet" hint="Levels are % of the initial fixing.">
              <ParamControl
                label="Maturity"
                value={params.maturity}
                onChange={set('maturity')}
                min={0.5}
                max={5}
                step={0.5}
                unit="yrs"
                digits={1}
              />
              <ParamControl
                label="Coupon p.a."
                value={params.couponPct}
                onChange={set('couponPct')}
                min={0}
                max={30}
                step={0.25}
                unit="%"
                digits={2}
              />
              <Segmented<string>
                label="Coupon frequency"
                value={String(params.frequency)}
                onChange={(v) => set('frequency')(Number(v) as Params['frequency'])}
                options={[
                  { value: '12', label: 'Monthly' },
                  { value: '4', label: 'Quarterly' },
                  { value: '1', label: 'Annual' },
                ]}
                className="w-full"
              />
              <ParamControl
                label="Conversion strike"
                value={params.strikePct}
                onChange={set('strikePct')}
                min={60}
                max={120}
                step={5}
                unit="%"
              />
              <Segmented<string>
                label="Barrier"
                value={params.barrier ? 'barrier' : 'plain'}
                onChange={(v) => set('barrier')(v === 'barrier')}
                options={[
                  { value: 'plain', label: 'Plain' },
                  { value: 'barrier', label: 'With barrier' },
                ]}
                className="w-full"
              />
              {params.barrier && (
                <ParamControl
                  label="Knock-in barrier"
                  value={params.barrierPct}
                  onChange={set('barrierPct')}
                  min={40}
                  max={params.strikePct}
                  step={5}
                  unit="%"
                />
              )}
            </PanelSection>
            <Separator />
            <ModelSection model={model} onChange={setModel} />
            <Separator />
            <MarketSection market={market} onChange={setMarket} />
          </Card>
        </aside>
        <div className="flex min-w-0 flex-col gap-6">
          {query.error && (
            <Alert variant="error">
              <AlertTriangleIcon />
              <AlertTitle>Pricing failed</AlertTitle>
              <AlertDescription>{query.error.message}</AlertDescription>
            </Alert>
          )}
          <Card className={cn('transition-opacity', stale && 'opacity-60')}>
            <div className="grid gap-6 p-6 lg:grid-cols-[minmax(0,15rem)_minmax(0,1fr)] lg:gap-8">
              <div>
                <p className="text-muted-foreground text-sm">Note value, % of notional</p>
                <p className="mt-1 font-semibold text-5xl tracking-tight tabular-nums">
                  {data ? pct(data.value) : '—'}
                </p>
                <p className="mt-1.5 text-muted-foreground text-xs">
                  {data && data.value > 1
                    ? 'Worth more than it costs: the coupon is too generous'
                    : 'Below 100%: the issuer keeps the difference'}
                </p>
                <Button
                  variant="outline"
                  size="sm"
                  className="mt-4"
                  disabled={!data}
                  onClick={() => data && set('couponPct')(Math.round(data.fair_coupon * 400) / 4)}
                >
                  Set the fair coupon
                </Button>
              </div>
              <StatGrid className="self-start grid-cols-2 sm:grid-cols-3">
                <Stat
                  label="Fair coupon"
                  value={data ? `${pct(data.fair_coupon)} p.a.` : '—'}
                  hint="Prices the note at 100%"
                />
                <Stat
                  label="Put sold"
                  value={data ? pct(-data.short_put) : '—'}
                  hint="Premium given up, % of notional"
                />
                <Stat
                  label="Chance the barrier is touched"
                  value={
                    data?.barrier_hit_probability == null
                      ? '—'
                      : pct(data.barrier_hit_probability, 1)
                  }
                  hint={
                    request.barrier == null
                      ? 'No barrier'
                      : data?.barrier_hit_probability == null
                        ? 'Black–Scholes only'
                        : 'Risk-neutral, continuous'
                  }
                />
              </StatGrid>
            </div>
          </Card>
          <Card className={cn('transition-opacity', stale && 'opacity-60')}>
            <CardHeader>
              <CardTitle className="text-base" render={<h2 />}>
                What the note is made of
              </CardTitle>
              <CardDescription>
                Every reverse convertible decomposes into three pieces anyone could buy separately.
                The note is fairly priced when they add up to 100%.
              </CardDescription>
            </CardHeader>
            <CardPanel className="pt-0">
              <StatGrid className="grid-cols-2 sm:grid-cols-4">
                <Stat
                  label="Zero-coupon bond"
                  value={data ? pct(data.bond) : '—'}
                  hint="Repays 100 at maturity"
                />
                <Stat
                  label="+ Coupons"
                  value={data ? pct(data.coupons) : '—'}
                  hint="Paid whatever happens"
                />
                <Stat
                  label="− Put sold"
                  value={data ? pct(-data.short_put) : '—'}
                  hint={request.barrier == null ? 'European put at the strike' : 'Down-and-in put'}
                />
                <Stat
                  label="= Note"
                  value={data ? pct(data.value) : '—'}
                  hint="What the investor holds"
                />
              </StatGrid>
            </CardPanel>
          </Card>
          <div className="grid gap-6 xl:grid-cols-2">
            <LinesChart
              title="What you get back at maturity"
              description="Redemption plus all coupons, by where the stock ends. Above the strike the investor gets 100 plus coupons; below it, shares worth less. With a barrier, that loss only applies if the stock touched the barrier along the way."
              series={payoff}
              xName="Final stock level (% of initial)"
              yName="Received (% of notional)"
              xFormat={(x) => fixed(x, 0)}
              yFormat={(y) => fixed(y, 1)}
              current={params.strikePct}
              stale={stale}
              ariaLabel="Total amount received at maturity against the final stock level"
            />
            <LinesChart
              title="Fair coupon against volatility"
              description="The more volatile the stock, the more the put is worth and the higher the coupon the issuer can offer. A high coupon is a signal of risk, not generosity."
              series={
                data
                  ? [
                      {
                        name: 'Fair coupon',
                        color: c.series1,
                        points: data.coupon_vs_vol.x.map((x, i) => [
                          x * 100,
                          data.coupon_vs_vol.y[i] * 100,
                        ]),
                        markers: true,
                      },
                    ]
                  : []
              }
              xName="Volatility (%)"
              yName="Fair coupon (% p.a.)"
              xFormat={(x) => fixed(x, 0)}
              yFormat={(y) => fixed(y, 1)}
              current={model.volPct}
              stale={stale}
              ariaLabel="Fair coupon against volatility"
            />
          </div>
        </div>
      </div>
    </>
  )
}
