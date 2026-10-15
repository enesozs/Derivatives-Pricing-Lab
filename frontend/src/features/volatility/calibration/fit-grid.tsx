import { useMemo } from 'react'
import { ChartCard, LegendKey } from '@/components/charts/chart-card'
import { EChart, type ChartOption } from '@/components/charts/echart'
import {
  axisStyle,
  tooltipHeader,
  tooltipRow,
  tooltipStyle,
  useChartColors,
  type ChartColors,
} from '@/components/charts/theme'
import type { CalibrationResponse } from '@/lib/api'
import { fixed } from '@/lib/format'
import { expiryLabel, maturityLabel } from '../format'

type Slice = CalibrationResponse['slices'][number]

function sliceOption(c: ChartColors, s: Slice): ChartOption {
  const axis = axisStyle(c)
  const order = s.strikes.map((_, i) => i).sort((a, b) => s.strikes[a] - s.strikes[b])
  return {
    animationDurationUpdate: 150,
    grid: { left: 4, right: 8, top: 12, bottom: 4, containLabel: true },
    tooltip: {
      ...tooltipStyle(c),
      trigger: 'item',
      formatter: (raw: unknown) => {
        const [strike, vol] = (raw as { value: number[] }).value
        return (
          tooltipHeader(`Strike ${fixed(strike, 1)}`) +
          tooltipRow(c.series1, `${fixed(vol, 2)}%`, 'Implied vol')
        )
      },
    },
    xAxis: {
      type: 'value',
      scale: true,
      ...axis,
      axisLabel: { ...axis.axisLabel, fontSize: 10, formatter: (v: number) => fixed(v, 0) },
      splitLine: { show: false },
    },
    yAxis: {
      type: 'value',
      scale: true,
      ...axis,
      axisLabel: { ...axis.axisLabel, fontSize: 10, formatter: (v: number) => fixed(v, 0) },
    },
    series: [
      {
        name: 'Market',
        type: 'scatter',
        data: order.map((i) => [s.strikes[i], s.market_vol[i] * 100]),
        symbolSize: 5,
        itemStyle: { color: c.series1, opacity: 0.85 },
      },
      {
        name: 'Model',
        type: 'line',
        data: order.map((i) => [
          s.strikes[i],
          s.model_vol[i] == null ? null : s.model_vol[i]! * 100,
        ]),
        showSymbol: false,
        lineStyle: { width: 2, color: c.series2 },
        itemStyle: { color: c.series2 },
      },
    ],
  }
}

export function FitGrid({
  data,
  stale,
}: {
  data: CalibrationResponse | undefined
  stale: boolean
}) {
  const c = useChartColors()
  const options = useMemo(() => data?.slices.map((s) => sliceOption(c, s)) ?? [], [data, c])
  return (
    <ChartCard
      title="Market vs model, expiry by expiry"
      description={
        data?.model === 'heston'
          ? 'One set of five Heston parameters must fit every expiry at once. Look for where it struggles: usually the shortest expiries, whose steep skews need jumps.'
          : 'SABR is fitted separately to each expiry, so it fits more closely, but it says nothing about how expiries connect.'
      }
      action={
        <div className="flex gap-4">
          <LegendKey color={c.series1} label="Market quotes" band />
          <LegendKey color={c.series2} label="Calibrated model" />
        </div>
      }
      stale={stale}
    >
      <div className="grid gap-4 sm:grid-cols-2 2xl:grid-cols-3">
        {data?.slices.map((s, i) => (
          <figure key={s.expiry} className="rounded-xl border p-3">
            <figcaption className="flex items-baseline justify-between text-xs">
              <span className="font-medium">
                {maturityLabel(s.t)} · {expiryLabel(s.expiry)}
              </span>
              <span className="text-muted-foreground tabular-nums">
                {fixed(s.rmse * 100, 2)} vol pts
              </span>
            </figcaption>
            <EChart
              option={options[i]}
              className="h-44"
              ariaLabel={`Market and model implied volatility, ${expiryLabel(s.expiry)}`}
            />
          </figure>
        ))}
      </div>
    </ChartCard>
  )
}
