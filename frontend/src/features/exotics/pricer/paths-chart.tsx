import { useMemo } from 'react'
import { ChartCard, LegendKey } from '@/components/charts/chart-card'
import { EChart, type ChartOption } from '@/components/charts/echart'
import { axisStyle, GRID, useChartColors } from '@/components/charts/theme'
import type { ExoticPathsResponse } from '@/lib/api'
import { fixed } from '@/lib/format'
import type { ExoticParams } from './params'

type Point = number[] | '-'

function joined(times: number[], rows: number[][]): Point[] {
  const out: Point[] = []
  for (const row of rows) {
    row.forEach((v, i) => out.push([times[i], v]))
    out.push('-')
  }
  return out
}

const CAPTIONS: Record<ExoticParams['product'], string> = {
  digital:
    'Blue paths finish in the money and pay the full amount; grey ones pay nothing, however close they finish.',
  barrier:
    'Each path is checked against the barrier. Grey paths touched it: knocked out (worthless) or knocked in (now a vanilla).',
  asian:
    'Dots at expiry are each path’s average over the fixing dates: that, not the final price, sets the payoff. Averages vary much less than final prices.',
  lookback:
    'Thin grey lines are prices; blue lines are each path’s running extreme, the price the option effectively locks in.',
}

export function PathsChart({
  data,
  stale,
  params,
}: {
  data: ExoticPathsResponse | undefined
  stale: boolean
  params: ExoticParams
}) {
  const c = useChartColors()
  const product = params.product

  const option = useMemo<ChartOption | null>(() => {
    if (!data) return null
    const axis = axisStyle(c)
    const { times, paths, payoffs } = data
    const lines: { name: string; yAxis: number }[] = []
    if (product !== 'lookback' || params.strikeType === 'fixed')
      lines.push({ name: 'Strike', yAxis: params.strike })

    const thin = (name: string, color: string, rows: number[][], opacity: number, z = 1) => ({
      name,
      type: 'line' as const,
      data: joined(times, rows),
      showSymbol: false,
      silent: true,
      lineStyle: { width: 1, color, opacity },
      z,
    })

    let series
    if (product === 'barrier' && data.hit) {
      const knocked = paths.filter((_, i) => data.hit![i])
      const clean = paths.filter((_, i) => !data.hit![i])
      series = [
        thin('Touched the barrier', c.muted, knocked, 0.5),
        {
          ...thin('Never touched', c.series1, clean, 0.75, 2),
          markLine: {
            silent: true,
            symbol: 'none',
            lineStyle: { color: c.series2, width: 2, type: 'solid' as const },
            label: { color: c.ink2, fontSize: 11, formatter: '{b}' },
            data: [{ name: 'Barrier', yAxis: params.barrier }],
          },
        },
      ]
    } else if (product === 'lookback' && data.extremes) {
      const shown = paths.slice(0, 8)
      series = [
        thin('Price path', c.muted, shown, 0.6),
        thin('Running extreme', c.series1, data.extremes.slice(0, 8), 0.9, 2),
      ]
    } else {
      const paid = paths.filter((_, i) => payoffs[i] > 0)
      const zero = paths.filter((_, i) => payoffs[i] <= 0)
      series = [
        thin('Pays nothing', c.muted, zero, 0.5),
        thin('Pays out', c.series1, paid, 0.75, 2),
      ]
      if (product === 'asian' && data.averages) {
        series.push({
          name: 'Average price',
          type: 'scatter' as const,
          data: data.averages.map((a) => [times[times.length - 1], a]),
          symbolSize: 8,
          itemStyle: { color: c.series2, borderColor: c.surface, borderWidth: 2 },
          z: 3,
        } as never)
      }
    }
    if (lines.length) {
      const target = series[series.length - 1] as Record<string, unknown>
      const existing = (target.markLine as { data: unknown[] } | undefined)?.data ?? []
      target.markLine = {
        silent: true,
        symbol: 'none',
        lineStyle: { color: c.axis, width: 1, type: 'solid' },
        label: { color: c.muted, fontSize: 11, formatter: '{b}' },
        ...(target.markLine as object),
        data: [...existing, ...lines],
      }
    }
    return {
      animation: false,
      grid: { ...GRID, right: 52 }, // room for the Strike/Barrier labels
      xAxis: {
        type: 'value',
        name: 'Years',
        nameLocation: 'middle',
        nameGap: 28,
        min: 0,
        max: times[times.length - 1],
        ...axis,
        splitLine: { show: false },
      },
      yAxis: {
        type: 'value',
        name: 'Spot',
        scale: true,
        ...axis,
        axisLabel: { ...axis.axisLabel, formatter: (v: number) => fixed(v, 0) },
      },
      series: series as ChartOption['series'],
    }
  }, [data, c, product, params.barrier, params.strike, params.strikeType])

  const legend =
    product === 'barrier'
      ? [
          { color: c.series1, label: 'Never touched' },
          { color: c.muted, label: 'Touched the barrier' },
          { color: c.series2, label: 'Barrier' },
        ]
      : product === 'lookback'
        ? [
            { color: c.muted, label: 'Price' },
            { color: c.series1, label: 'Running extreme' },
          ]
        : [
            { color: c.series1, label: 'Pays out' },
            { color: c.muted, label: 'Pays nothing' },
            ...(product === 'asian' ? [{ color: c.series2, label: 'Average price' }] : []),
          ]

  return (
    <ChartCard
      title="How the payoff works, path by path"
      description={`Simulated price paths under the chosen model. ${CAPTIONS[product]}`}
      action={
        <div className="flex flex-wrap gap-x-4 gap-y-1">
          {legend.map((l) => (
            <LegendKey key={l.label} color={l.color} label={l.label} />
          ))}
        </div>
      }
      stale={stale}
    >
      {option ? (
        <EChart
          option={option}
          className="h-80"
          ariaLabel="Simulated price paths illustrating the exotic payoff"
        />
      ) : (
        <div className="h-80" />
      )}
    </ChartCard>
  )
}
