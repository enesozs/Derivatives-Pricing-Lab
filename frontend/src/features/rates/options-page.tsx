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
import { PageHeader } from '@/components/page-header'
import { PanelSection } from '@/components/panel-section'
import { ParamControl } from '@/components/param-control'
import { Segmented } from '@/components/segmented'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Card } from '@/components/ui/card'
import { Separator } from '@/components/ui/separator'
import { useDebouncedValue } from '@/hooks/use-debounced-value'
import { api, type RateOptionRequest, type RateOptionResponse } from '@/lib/api'
import { compact, fixed } from '@/lib/format'
import { cn } from '@/lib/utils'
import { tenorLabel, useCurveQuotes } from './curve-context'
import { CurveNote } from './curve-note'
import { money } from './format'
import { Stat, StatGrid } from './stats'

const NOTIONAL = 10_000_000

type Product = RateOptionRequest['product']
type VolModel = RateOptionRequest['vol_model']

interface Params {
  product: Product
  strikeMode: 'atm' | 'custom'
  strikePct: number
  maturity: number
  frequency: number
  expiry: number
  tenor: number
  volModel: VolModel
  blackVolPct: number
  normalVolBp: number
}

const DEFAULTS: Params = {
  product: 'cap',
  strikeMode: 'atm',
  strikePct: 4,
  maturity: 5,
  frequency: 4,
  expiry: 2,
  tenor: 5,
  volModel: 'black',
  blackVolPct: 25,
  normalVolBp: 100,
}

const PRODUCT_LABEL: Record<Product, string> = {
  cap: 'Cap',
  floor: 'Floor',
  payer: 'Payer swaption',
  receiver: 'Receiver swaption',
}

function CapletChart({ data, stale }: { data?: RateOptionResponse; stale: boolean }) {
  const c = useChartColors()
  const option = useMemo<ChartOption | null>(() => {
    const rows = data?.caplets
    if (!rows) return null
    const axis = axisStyle(c)
    return {
      animationDurationUpdate: 150,
      grid: GRID,
      tooltip: {
        ...tooltipStyle(c),
        axisPointer: { type: 'shadow' },
        formatter: (raw: unknown) => {
          const i = (raw as { dataIndex: number }[])[0]?.dataIndex ?? 0
          const r = rows[i]
          return (
            tooltipHeader(`Fixes ${fixed(r.fixing, 2)}y · pays ${fixed(r.payment, 2)}y`) +
            tooltipRow(c.series1, money(r.value), 'Value') +
            tooltipRow(c.muted, `${fixed(r.forward * 100, 3)}%`, 'Forward rate')
          )
        },
      },
      xAxis: {
        type: 'category',
        data: rows.map((r) => fixed(r.fixing, 2)),
        name: 'Fixing date (years)',
        nameLocation: 'middle',
        nameGap: 28,
        ...axis,
        splitLine: { show: false },
      },
      yAxis: {
        type: 'value',
        name: 'Value',
        ...axis,
        axisLabel: { ...axis.axisLabel, formatter: (v: number) => compact(v) },
      },
      series: [
        {
          name: 'Caplet value',
          type: 'bar',
          data: rows.map((r) => r.value),
          barMaxWidth: 24,
          itemStyle: { color: c.series1, borderRadius: [4, 4, 0, 0] },
        },
      ],
    }
  }, [data, c])
  if (!data?.caplets) return null
  return (
    <ChartCard
      title="One option per period"
      description="A cap is a strip of caplets, each a call on one period’s forward rate. Later caplets are worth more: more time for the rate to move. The first period is excluded because its rate is already fixed."
      stale={stale}
    >
      {option && (
        <EChart option={option} ariaLabel="Value of each caplet or floorlet by fixing date" />
      )}
    </ChartCard>
  )
}

function SmileChart({
  data,
  strike,
  stale,
}: {
  data?: RateOptionResponse
  strike: number | undefined
  stale: boolean
}) {
  const c = useChartColors()
  const option = useMemo<ChartOption | null>(() => {
    if (!data) return null
    const axis = axisStyle(c)
    const k = data.smile_strikes
    return {
      animationDurationUpdate: 150,
      grid: GRID,
      tooltip: {
        ...tooltipStyle(c),
        formatter: (raw: unknown) => {
          const i = (raw as { dataIndex: number }[])[0]?.dataIndex ?? 0
          const normal = data.smile_from_normal[i]
          return (
            tooltipHeader(`Strike ${fixed(k[i] * 100, 2)}%`) +
            tooltipRow(c.series1, `${fixed(data.smile_black[i] * 100, 1)}%`, 'Black (lognormal)') +
            tooltipRow(
              c.series2,
              normal == null ? '—' : `${fixed(normal * 100, 1)}%`,
              'Bachelier, as Black vol',
            )
          )
        },
      },
      xAxis: {
        type: 'value',
        name: 'Strike (%)',
        nameLocation: 'middle',
        nameGap: 28,
        min: 'dataMin',
        max: 'dataMax',
        ...axis,
        splitLine: { show: false },
        axisLabel: { ...axis.axisLabel, formatter: (v: number) => fixed(v, 1) },
      },
      yAxis: { type: 'value', name: 'Black vol (%)', scale: true, ...axis },
      series: [
        {
          name: 'Black',
          type: 'line',
          data: k.map((x, i) => [x * 100, data.smile_black[i] * 100]),
          showSymbol: false,
          lineStyle: { width: 2, color: c.series1 },
          itemStyle: { color: c.series1 },
          markLine:
            strike == null
              ? undefined
              : {
                  silent: true,
                  symbol: 'none',
                  lineStyle: { color: c.axis, type: 'dashed', width: 1 },
                  label: { formatter: 'strike', color: c.muted, fontSize: 11 },
                  data: [{ xAxis: strike * 100 }],
                },
        },
        {
          name: 'Bachelier',
          type: 'line',
          data: k.flatMap((x, i) =>
            data.smile_from_normal[i] == null ? [] : [[x * 100, data.smile_from_normal[i]! * 100]],
          ),
          showSymbol: false,
          lineStyle: { width: 2, color: c.series2 },
          itemStyle: { color: c.series2 },
        },
      ],
    }
  }, [data, strike, c])
  return (
    <ChartCard
      title="What each model assumes about the smile"
      description="Both models matched at the money. In Black’s model rates move in proportion to their level, so its implied vol is flat. In Bachelier’s they move by fixed amounts, so low strikes need a higher Black vol: a built-in skew, close to what rates markets show."
      action={
        <div className="flex gap-4">
          <LegendKey color={c.series1} label="Black" />
          <LegendKey color={c.series2} label="Bachelier" />
        </div>
      }
      stale={stale}
    >
      {option ? (
        <EChart
          option={option}
          ariaLabel="Black implied volatility by strike under the Black and Bachelier models"
        />
      ) : (
        <div className="h-72" />
      )}
    </ChartCard>
  )
}

export default function RateOptionsPage() {
  const { quotes } = useCurveQuotes()
  const [params, setParams] = useState(DEFAULTS)
  const settled = useDebouncedValue(params, 150)
  const curve = useDebouncedValue(quotes, 150)
  const isCap = params.product === 'cap' || params.product === 'floor'
  const request = useMemo<RateOptionRequest>(
    () => ({
      quotes: curve,
      product: settled.product,
      strike: settled.strikeMode === 'atm' ? null : settled.strikePct / 100,
      maturity: settled.maturity,
      expiry: settled.expiry,
      tenor: settled.tenor,
      frequency: settled.frequency,
      vol_model: settled.volModel,
      vol: settled.volModel === 'black' ? settled.blackVolPct / 100 : settled.normalVolBp / 10_000,
      notional: NOTIONAL,
    }),
    [settled, curve],
  )
  const query = useQuery({
    queryKey: ['rates', 'options', request],
    queryFn: ({ signal }) => api.rateOptions(request, signal),
    placeholderData: keepPreviousData,
  })
  const data = query.data
  const stale = query.isPlaceholderData
  const set =
    <K extends keyof Params>(key: K) =>
    (value: Params[K]) =>
      setParams({ ...params, [key]: value })
  const equivalent =
    data?.equivalent_vol == null
      ? '—'
      : settled.volModel === 'black'
        ? `${fixed(data.equivalent_vol * 10_000, 1)}bp`
        : `${fixed(data.equivalent_vol * 100, 2)}%`
  const description = isCap
    ? `${tenorLabel(params.maturity)} ${params.product}, ${params.frequency === 4 ? 'quarterly' : 'semi-annual'} periods`
    : `${tenorLabel(params.expiry)} into ${tenorLabel(params.tenor)} ${params.product} swaption`

  return (
    <>
      <PageHeader title="Caps, floors and swaptions">
        Options on interest rates. A cap pays whenever a floating rate fixes above the strike:
        insurance for a floating-rate borrower. A swaption is the right to enter a swap at a fixed
        rate agreed today.
      </PageHeader>
      <div className="grid gap-6 lg:grid-cols-[20rem_minmax(0,1fr)]">
        <aside>
          <Card className="overflow-hidden">
            <PanelSection title="Product">
              <Segmented<Product>
                label="Product"
                value={params.product}
                onChange={set('product')}
                options={[
                  { value: 'cap', label: 'Cap' },
                  { value: 'floor', label: 'Floor' },
                  { value: 'payer', label: 'Payer' },
                  { value: 'receiver', label: 'Receiver' },
                ]}
                className="w-full"
              />
              {isCap ? (
                <>
                  <ParamControl
                    label="Maturity"
                    value={params.maturity}
                    onChange={set('maturity')}
                    min={1}
                    max={20}
                    step={1}
                    unit="yrs"
                  />
                  <Segmented<string>
                    label="Reset frequency"
                    value={String(params.frequency)}
                    onChange={(v) => set('frequency')(Number(v))}
                    options={[
                      { value: '4', label: 'Quarterly' },
                      { value: '2', label: 'Semi-annual' },
                    ]}
                    className="w-full"
                  />
                </>
              ) : (
                <>
                  <ParamControl
                    label="Option expiry"
                    value={params.expiry}
                    onChange={set('expiry')}
                    min={0.25}
                    max={10}
                    step={0.25}
                    unit="yrs"
                    digits={2}
                  />
                  <ParamControl
                    label="Swap tenor"
                    value={params.tenor}
                    onChange={set('tenor')}
                    min={1}
                    max={20}
                    step={1}
                    unit="yrs"
                  />
                </>
              )}
              <Segmented<Params['strikeMode']>
                label="Strike"
                value={params.strikeMode}
                onChange={set('strikeMode')}
                options={[
                  { value: 'atm', label: 'At the money' },
                  { value: 'custom', label: 'Custom strike' },
                ]}
                className="w-full"
              />
              {params.strikeMode === 'custom' && (
                <ParamControl
                  label="Strike"
                  value={params.strikePct}
                  onChange={set('strikePct')}
                  min={0.25}
                  max={10}
                  step={0.05}
                  unit="%"
                  digits={2}
                />
              )}
            </PanelSection>
            <Separator />
            <PanelSection
              title="Volatility"
              hint="Black vols are quoted as % of the rate, normal vols in basis points a year. Same price, two languages."
            >
              <Segmented<VolModel>
                label="Volatility model"
                value={params.volModel}
                onChange={set('volModel')}
                options={[
                  { value: 'black', label: 'Black (lognormal)' },
                  { value: 'bachelier', label: 'Bachelier (normal)' },
                ]}
                className="w-full"
              />
              {params.volModel === 'black' ? (
                <ParamControl
                  label="Black vol"
                  value={params.blackVolPct}
                  onChange={set('blackVolPct')}
                  min={5}
                  max={80}
                  step={1}
                  unit="%"
                />
              ) : (
                <ParamControl
                  label="Normal vol"
                  value={params.normalVolBp}
                  onChange={set('normalVolBp')}
                  min={10}
                  max={250}
                  step={5}
                  unit="bp"
                />
              )}
            </PanelSection>
          </Card>
        </aside>
        <div className="flex min-w-0 flex-col gap-6">
          <CurveNote />
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
                <p className="text-muted-foreground text-sm">
                  {PRODUCT_LABEL[params.product]} premium
                </p>
                <p className="mt-1 font-semibold text-5xl tracking-tight tabular-nums">
                  {money(data?.price)}
                </p>
                <p className="mt-1.5 text-muted-foreground text-xs">
                  {description} ·{' '}
                  {data
                    ? `${fixed((data.price / NOTIONAL) * 10_000, 1)}bp of ${money(NOTIONAL)}`
                    : ''}
                </p>
              </div>
              <StatGrid className="self-start sm:grid-cols-3">
                <Stat
                  label="Strike"
                  value={data ? `${fixed(data.strike * 100, 3)}%` : '—'}
                  hint={params.strikeMode === 'atm' ? 'At the money' : 'Custom'}
                />
                <Stat
                  label={isCap ? 'Last forward rate' : 'Forward swap rate'}
                  value={data ? `${fixed(data.atm_forward * 100, 3)}%` : '—'}
                  hint={isCap ? 'What the final caplet is on' : 'Fair fixed rate at expiry'}
                />
                <Stat
                  label={
                    params.volModel === 'black' ? 'Equivalent normal vol' : 'Equivalent Black vol'
                  }
                  value={equivalent}
                  hint="Same price in the other model"
                />
              </StatGrid>
            </div>
          </Card>
          <div className={cn('grid gap-6', isCap && 'xl:grid-cols-2')}>
            <CapletChart data={data} stale={stale} />
            <SmileChart data={data} strike={data?.strike} stale={stale} />
          </div>
        </div>
      </div>
    </>
  )
}
