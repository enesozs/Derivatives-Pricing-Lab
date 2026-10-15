import { useMemo } from 'react'
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
import type { PDEGridResponse } from '@/lib/api'
import { fixed } from '@/lib/format'

interface PDEChartProps {
  data: PDEGridResponse | undefined
  stale: boolean
  strike: number
  expiry: number
}

function sliceLabel(time: number, expiry: number): string {
  if (time < 1e-9) return 'Today'
  return `${Math.round((time / expiry) * 100)}% of the way`
}

export function PDESlicesChart({ data, stale, strike, expiry }: PDEChartProps) {
  const c = useChartColors()

  const option = useMemo<ChartOption | null>(() => {
    if (!data) return null
    const axis = axisStyle(c)
    return {
      animationDurationUpdate: 200,
      grid: GRID,
      tooltip: {
        ...tooltipStyle(c),
        formatter: (raw: unknown) => {
          const i = (raw as { dataIndex: number }[])[0]?.dataIndex ?? 0
          return (
            tooltipHeader(`Spot ${fixed(data.spots[i], 2)}`) +
            data.slices
              .map((s, k) =>
                tooltipRow(c.ordinal[k], fixed(s.values[i], 3), sliceLabel(s.time, expiry)),
              )
              .join('') +
            tooltipRow(c.series2, fixed(data.payoff[i], 3), 'Payoff at expiry')
          )
        },
      },
      xAxis: {
        type: 'value',
        name: 'Spot price',
        nameLocation: 'middle',
        nameGap: 28,
        min: data.spots[0],
        max: data.spots[data.spots.length - 1],
        ...axis,
        axisLabel: { ...axis.axisLabel, formatter: (v: number) => fixed(v, 0) },
        splitLine: { show: false },
      },
      yAxis: { type: 'value', name: 'Option value', ...axis },
      series: [
        ...data.slices.map((s, k) => ({
          name: sliceLabel(s.time, expiry),
          type: 'line' as const,
          data: data.spots.map((x, i) => [x, s.values[i]]),
          showSymbol: false,
          lineStyle: { width: 2, color: c.ordinal[k] },
          itemStyle: { color: c.ordinal[k] },
        })),
        {
          name: 'Payoff at expiry',
          type: 'line' as const,
          data: data.spots.map((x, i) => [x, data.payoff[i]]),
          showSymbol: false,
          lineStyle: { width: 2, color: c.series2 },
          itemStyle: { color: c.series2 },
          markLine: {
            silent: true,
            symbol: 'none',
            lineStyle: { color: c.axis, width: 1, type: 'solid' as const },
            label: { color: c.muted, fontSize: 11, formatter: '{b}' },
            data: [{ name: 'Strike', xAxis: strike }],
          },
        },
      ],
    }
  }, [data, c, strike, expiry])

  return (
    <ChartCard
      title="The PDE solution as time runs out"
      description="The Crank–Nicolson grid holds the option's value at every spot and date. Time value shrinks as expiry approaches and each curve sinks onto the payoff."
      action={
        data && (
          <div className="flex flex-wrap gap-x-4 gap-y-1">
            {data.slices.map((s, k) => (
              <LegendKey key={s.time} color={c.ordinal[k]} label={sliceLabel(s.time, expiry)} />
            ))}
            <LegendKey color={c.series2} label="Payoff" />
          </div>
        )
      }
      stale={stale}
    >
      {option ? (
        <EChart
          option={option}
          ariaLabel="Option value across spot at several dates before expiry"
        />
      ) : (
        <div className="h-72" />
      )}
    </ChartCard>
  )
}

export function ExerciseBoundaryChart({
  data,
  stale,
  strike,
  american,
  kind,
}: PDEChartProps & {
  american: boolean
  kind: 'call' | 'put'
}) {
  const c = useChartColors()

  const option = useMemo<ChartOption | null>(() => {
    if (!data || !american) return null
    const axis = axisStyle(c)
    const points = data.boundary_times
      .map((t, i) => [t, data.boundary_spots[i]] as const)
      .filter((p): p is readonly [number, number] => p[1] !== null)
    if (points.length === 0) return null
    return {
      animationDurationUpdate: 200,
      grid: GRID,
      tooltip: {
        ...tooltipStyle(c),
        formatter: (raw: unknown) => {
          const i = (raw as { dataIndex: number }[])[0]?.dataIndex ?? 0
          const [t, s] = points[i]
          return (
            tooltipHeader(`t = ${fixed(t, 3)}y`) +
            tooltipRow(c.series1, fixed(s, 2), kind === 'put' ? 'Exercise below' : 'Exercise above')
          )
        },
      },
      xAxis: {
        type: 'value',
        name: 'Time from today (years)',
        nameLocation: 'middle',
        nameGap: 28,
        min: 0,
        ...axis,
        splitLine: { show: false },
      },
      yAxis: { type: 'value', name: 'Spot', scale: true, ...axis },
      series: [
        {
          name: 'Exercise boundary',
          type: 'line',
          data: points.map((p) => [...p]),
          showSymbol: false,
          lineStyle: { width: 2, color: c.series1 },
          itemStyle: { color: c.series1 },
          // Shade the region where exercising immediately is optimal.
          areaStyle: { color: c.band, origin: kind === 'put' ? 'start' : 'end' },
          markLine: {
            silent: true,
            symbol: 'none',
            lineStyle: { color: c.axis, width: 1, type: 'solid' },
            label: { color: c.muted, fontSize: 11, formatter: '{b}' },
            data: [{ name: 'Strike', yAxis: strike }],
          },
        },
      ],
    }
  }, [data, c, strike, american, kind])

  return (
    <ChartCard
      title="Early-exercise boundary"
      description={
        american
          ? `The critical spot at each date: an American ${kind} is worth more dead than alive ${kind === 'put' ? 'below' : 'above'} it (shaded). It approaches the strike at expiry.`
          : 'European options can only be exercised at expiry, so there is no boundary.'
      }
      stale={stale}
    >
      {option ? (
        <EChart option={option} ariaLabel="Early exercise boundary: critical spot over time" />
      ) : (
        <div className="flex h-72 flex-col items-center justify-center gap-1 rounded-xl border border-dashed text-center">
          <p className="font-medium text-sm">
            {american ? 'Never optimal to exercise early here' : 'Switch to American exercise'}
          </p>
          <p className="max-w-80 text-muted-foreground text-xs">
            {american
              ? 'An American call on a stock paying no dividends is never exercised early. Add a dividend yield to see a boundary.'
              : 'Set the exercise style to American in the panel to see where early exercise pays.'}
          </p>
        </div>
      )}
    </ChartCard>
  )
}
