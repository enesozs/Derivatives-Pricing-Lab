import { keepPreviousData, useQuery } from '@tanstack/react-query'
import { AlertTriangleIcon } from 'lucide-react'
import { useMemo, useState } from 'react'
import { ChartCard, LegendKey } from '@/components/charts/chart-card'
import { EChart, type ChartOption } from '@/components/charts/echart'
import {
  axisStyle,
  GRID,
  tooltipHeader,
  tooltipRow,
  tooltipStyle,
  useChartColors,
} from '@/components/charts/theme'
import { NumberInput } from '@/components/number-input'
import { PageHeader } from '@/components/page-header'
import { PanelSection } from '@/components/panel-section'
import { ParamControl } from '@/components/param-control'
import { Segmented } from '@/components/segmented'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { Card } from '@/components/ui/card'
import { Separator } from '@/components/ui/separator'
import { useDebouncedValue } from '@/hooks/use-debounced-value'
import { api, type MultiAssetProduct, type MultiAssetResponse, type OptionKind } from '@/lib/api'
import { fixed, milliseconds, signed } from '@/lib/format'
import { cn } from '@/lib/utils'
import { CorrelationChart } from './correlation-chart'

interface Asset {
  spot: number
  volPct: number
  divPct: number
}

interface Params {
  product: MultiAssetProduct
  kind: OptionKind
  strike: number
  expiry: number
  ratePct: number
  assets: Asset[]
  correlation: number
  mcPaths: number
}

const ASSET_DEFAULTS: Asset[] = [
  { spot: 100, volPct: 25, divPct: 0 },
  { spot: 100, volPct: 30, divPct: 0 },
  { spot: 100, volPct: 20, divPct: 0 },
  { spot: 100, volPct: 35, divPct: 0 },
  { spot: 100, volPct: 22, divPct: 0 },
]

const DEFAULTS: Params = {
  product: 'basket',
  kind: 'call',
  strike: 100,
  expiry: 1,
  ratePct: 5,
  assets: ASSET_DEFAULTS.slice(0, 2),
  correlation: 0.4,
  mcPaths: 100_000,
}

const INTROS: Record<MultiAssetProduct, string> = {
  basket:
    'On the equally weighted average of the assets. Diversification makes the basket less volatile than its parts, unless they move together.',
  exchange:
    'The right to swap asset 2 for asset 1. Only the difference matters, so only the volatility of the ratio counts.',
  spread:
    'On the difference S₁ − S₂ against a strike: crack and spark spreads in energy, calendar spreads in rates.',
  best_of:
    'On the best performer. Low correlation means the best of several is likely to be far ahead.',
  worst_of:
    'On the worst performer. Cheap when assets diverge; the heart of many structured products.',
}

const CORRELATION_STORY: Record<MultiAssetProduct, string> = {
  basket:
    'Higher correlation, less diversification, a more volatile basket: the basket option gets dearer.',
  exchange:
    'Higher correlation, the assets move together, their difference shrinks: the exchange option gets cheaper.',
  spread: 'Higher correlation shrinks the spread’s volatility: spread options get cheaper.',
  best_of: 'Higher correlation, less chance one asset breaks away: best-of options get cheaper.',
  worst_of:
    'Higher correlation, less chance one asset lags far behind: worst-of options get dearer.',
}

function ScatterChart({ data, stale }: { data: MultiAssetResponse | undefined; stale: boolean }) {
  const c = useChartColors()
  const option = useMemo<ChartOption | null>(() => {
    if (!data) return null
    const axis = axisStyle(c)
    const pts = data.scatter_x.map((x, i) => [x * 100, data.scatter_y[i] * 100])
    return {
      animation: false,
      grid: GRID,
      tooltip: {
        ...tooltipStyle(c),
        trigger: 'item',
        formatter: (raw: unknown) => {
          const v = (raw as { value: number[] }).value
          return (
            tooltipHeader('Simulated scenario') +
            tooltipRow(c.series1, `${signed(v[0], 1)}%`, 'Asset 1') +
            tooltipRow(c.series2, `${signed(v[1], 1)}%`, 'Asset 2')
          )
        },
      },
      xAxis: {
        type: 'value',
        name: 'Asset 1 log-return (%)',
        nameLocation: 'middle',
        nameGap: 28,
        ...axis,
        axisLabel: { ...axis.axisLabel, formatter: (v: number) => fixed(v, 0) },
      },
      yAxis: {
        type: 'value',
        name: 'Asset 2 log-return (%)',
        ...axis,
        axisLabel: { ...axis.axisLabel, formatter: (v: number) => fixed(v, 0) },
      },
      series: [
        {
          name: 'Pays nothing',
          type: 'scatter',
          data: pts.filter((_, i) => !data.scatter_pays[i]),
          symbolSize: 5,
          itemStyle: { color: c.muted, opacity: 0.5 },
        },
        {
          name: 'Pays out',
          type: 'scatter',
          data: pts.filter((_, i) => data.scatter_pays[i]),
          symbolSize: 5,
          itemStyle: { color: c.series1, opacity: 0.8 },
        },
      ],
    }
  }, [data, c])
  return (
    <ChartCard
      title="Joint scenarios at expiry"
      description="Each dot is one simulated outcome for assets 1 and 2. Correlation shapes the cloud: round when independent, a thin diagonal when they move together. Blue scenarios pay."
      action={
        <div className="flex gap-4">
          <LegendKey color={c.series1} label="Pays out" band />
          <LegendKey color={c.muted} label="Pays nothing" band />
        </div>
      }
      stale={stale}
    >
      {option ? (
        <EChart option={option} ariaLabel="Scatter of simulated terminal returns of two assets" />
      ) : (
        <div className="h-72" />
      )}
    </ChartCard>
  )
}

export default function CorrelationPage() {
  const [params, setParams] = useState(DEFAULTS)
  const settled = useDebouncedValue(params, 250)
  const request = useMemo(
    () => ({
      product: settled.product,
      kind: settled.kind,
      strike: settled.product === 'exchange' ? 0 : settled.strike,
      expiry: settled.expiry,
      rate: settled.ratePct / 100,
      assets: settled.assets.map((a) => ({
        spot: a.spot,
        volatility: a.volPct / 100,
        dividend_yield: a.divPct / 100,
      })),
      correlation: settled.correlation,
      mc_paths: settled.mcPaths,
      seed: 42,
    }),
    [settled],
  )
  const query = useQuery({
    queryKey: ['multi-asset', request],
    queryFn: ({ signal }) => api.multiAsset(request, signal),
    placeholderData: keepPreviousData,
  })
  const set =
    <K extends keyof Params>(key: K) =>
    (value: Params[K]) =>
      setParams({ ...params, [key]: value })
  const n = params.assets.length
  const minRho = Math.ceil((-1 / (n - 1) + 0.02) * 100) / 100
  const twoOnly = params.product === 'exchange' || params.product === 'spread'
  const setCount = (count: number) =>
    setParams({
      ...params,
      assets: Array.from({ length: count }, (_, i) => params.assets[i] ?? ASSET_DEFAULTS[i]),
      correlation: Math.max(params.correlation, Math.ceil((-1 / (count - 1) + 0.02) * 100) / 100),
    })
  const setAsset = (i: number, patch: Partial<Asset>) =>
    setParams({
      ...params,
      assets: params.assets.map((a, j) => (j === i ? { ...a, ...patch } : a)),
    })
  const data = query.data
  const stale = query.isPlaceholderData

  return (
    <>
      <PageHeader title="Correlation lab">
        Options on several assets at once. Their prices depend on how the assets move together, so
        correlation becomes a risk you can lose money on.
      </PageHeader>
      <div className="grid gap-6 lg:grid-cols-[22rem_minmax(0,1fr)]">
        <aside>
          <Card className="overflow-hidden">
            <PanelSection title="Product" hint={INTROS[params.product]}>
              <Segmented<MultiAssetProduct>
                label="Product"
                size="sm"
                value={params.product}
                onChange={(product) =>
                  setParams({
                    ...params,
                    product,
                    ...(product === 'exchange' || product === 'spread'
                      ? {
                          assets: params.assets.slice(0, 2),
                          strike: product === 'spread' ? 5 : params.strike,
                        }
                      : {}),
                  })
                }
                options={[
                  { value: 'basket', label: 'Basket' },
                  { value: 'exchange', label: 'Exchange' },
                  { value: 'spread', label: 'Spread' },
                  { value: 'best_of', label: 'Best-of' },
                  { value: 'worst_of', label: 'Worst-of' },
                ]}
                className="w-full flex-wrap"
              />
              {params.product !== 'exchange' && (
                <>
                  <Segmented<OptionKind>
                    label="Option type"
                    value={params.kind}
                    onChange={set('kind')}
                    options={[
                      { value: 'call', label: 'Call' },
                      { value: 'put', label: 'Put' },
                    ]}
                    className="w-full"
                  />
                  <ParamControl
                    label="Strike"
                    value={params.strike}
                    onChange={set('strike')}
                    min={params.product === 'spread' ? -30 : 50}
                    max={params.product === 'spread' ? 30 : 150}
                    step={1}
                  />
                </>
              )}
              <ParamControl
                label="Time to expiry"
                value={params.expiry}
                onChange={set('expiry')}
                min={0.1}
                max={5}
                step={0.05}
                unit="yrs"
                digits={2}
              />
            </PanelSection>
            <Separator />
            <PanelSection
              title="Assets"
              hint={
                twoOnly
                  ? 'This product is defined on exactly two assets.'
                  : 'Closed forms exist for two assets; beyond that only Monte Carlo.'
              }
            >
              {!twoOnly && (
                <Segmented<string>
                  label="Number of assets"
                  value={String(n)}
                  onChange={(v) => setCount(Number(v))}
                  options={['2', '3', '4', '5'].map((v) => ({ value: v, label: `${v} assets` }))}
                  size="sm"
                  className="w-full"
                />
              )}
              {params.assets.map((a, i) => (
                <div key={i} className="grid grid-cols-[3.5rem_1fr_1fr_1fr] items-end gap-2">
                  <span className="pb-1.5 font-medium text-xs">Asset {i + 1}</span>
                  <NumberInput
                    label="Spot"
                    value={a.spot}
                    onChange={(v) => setAsset(i, { spot: v })}
                    min={1}
                    max={1000}
                  />
                  <NumberInput
                    label="Vol"
                    value={a.volPct}
                    onChange={(v) => setAsset(i, { volPct: v })}
                    min={1}
                    max={150}
                    unit="%"
                  />
                  <NumberInput
                    label="Div"
                    value={a.divPct}
                    onChange={(v) => setAsset(i, { divPct: v })}
                    min={0}
                    max={15}
                    step={0.5}
                    digits={1}
                    unit="%"
                  />
                </div>
              ))}
              <ParamControl
                label={n > 2 ? 'Correlation (every pair)' : 'Correlation'}
                value={params.correlation}
                onChange={set('correlation')}
                min={minRho}
                max={0.99}
                step={0.01}
                digits={2}
              />
            </PanelSection>
            <Separator />
            <PanelSection title="Market & simulation">
              <ParamControl
                label="Risk-free rate"
                value={params.ratePct}
                onChange={set('ratePct')}
                min={0}
                max={15}
                step={0.25}
                unit="%"
                digits={2}
              />
              <ParamControl
                label="Monte Carlo paths"
                value={params.mcPaths}
                onChange={set('mcPaths')}
                min={10_000}
                max={300_000}
                step={10_000}
              />
            </PanelSection>
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
            <div className="grid gap-6 p-6 lg:grid-cols-[minmax(0,17rem)_minmax(0,1fr)] lg:gap-8">
              <div>
                <p className="text-muted-foreground text-sm">Option value</p>
                <p className="mt-1 font-semibold text-5xl tracking-tight">
                  {data ? fixed(data.value, 4) : '—'}
                </p>
                <p className="mt-1.5 text-muted-foreground text-xs">
                  {data?.value_label ?? 'Pricing…'}
                </p>
                {data && (
                  <div className="mt-4 border-t pt-4">
                    <span className="text-muted-foreground text-xs">Correlation sensitivity</span>
                    <p className="font-semibold text-lg tabular-nums">
                      {signed(data.correlation_sensitivity * 0.1, 4)}
                    </p>
                    <span className="text-[11px] text-muted-foreground">
                      value change per +0.10 correlation
                    </span>
                  </div>
                )}
              </div>
              <div className="flex flex-col gap-2">
                <h2 className="font-semibold text-sm">Methods</h2>
                {(data?.methods ?? []).map((m) => (
                  <div
                    key={m.label}
                    className="flex items-start justify-between gap-4 rounded-xl border p-3"
                  >
                    <div>
                      <p className="font-medium text-sm">{m.label}</p>
                      <p className="text-muted-foreground text-xs">{m.note ?? ''}</p>
                    </div>
                    <div className="text-right">
                      {m.status === 'ok' ? (
                        <>
                          <p className="font-semibold tabular-nums">
                            {fixed(m.value, 4)}
                            {m.stderr != null && (
                              <span className="font-normal text-muted-foreground text-xs">
                                {' '}
                                ± {fixed(1.96 * m.stderr, 4)}
                              </span>
                            )}
                          </p>
                          <p className="text-muted-foreground text-xs">
                            {milliseconds(m.runtime_ms)}
                          </p>
                        </>
                      ) : (
                        <Badge variant="outline">Not available</Badge>
                      )}
                    </div>
                  </div>
                ))}
                {data?.methods[0].note?.includes('approximation') && (
                  <p className="text-muted-foreground text-xs">
                    This closed form is an approximation; the Monte Carlo row, which uses a control
                    variate, shows how close it is.
                  </p>
                )}
              </div>
            </div>
          </Card>
          <div className="grid gap-6 xl:grid-cols-2">
            <CorrelationChart
              grid={data?.correlation_grid}
              values={data?.correlation_values}
              current={settled.correlation}
              stale={stale}
              description={`${CORRELATION_STORY[settled.product]} Engine: ${data?.correlation_engine ?? '…'}.`}
            />
            <ScatterChart data={data} stale={stale} />
          </div>
        </div>
      </div>
    </>
  )
}
