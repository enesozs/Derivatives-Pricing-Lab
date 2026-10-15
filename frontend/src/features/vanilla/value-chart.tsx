import { useMemo } from 'react'
import { EChart, type ChartOption } from '@/components/charts/echart'
import {
  axisStyle,
  GRID,
  tooltipHeader,
  tooltipRow,
  tooltipStyle,
  useChartColors,
} from '@/components/charts/theme'
import { interpolate } from '@/components/charts/interpolate'
import type { ProfileResponse } from '@/lib/api'
import { fixed } from '@/lib/format'
import { ChartCard, LegendKey } from './chart-card'
import type { VanillaParams } from './params'

interface ValueChartProps {
  params: VanillaParams
  data: ProfileResponse | undefined
  stale: boolean
}

export function ValueChart({ params, data, stale }: ValueChartProps) {
  const c = useChartColors()

  const option = useMemo<ChartOption | null>(() => {
    if (!data) return null
    const today = data.spots.map((s, i) => [s, data.value[i]])
    const payoff = data.spots.map((s, i) => [s, data.payoff[i]])
    const axis = axisStyle(c)
    const atSpot = interpolate(data.spots, data.value, params.spot)
    return {
      animationDurationUpdate: 200,
      grid: GRID,
      tooltip: {
        ...tooltipStyle(c),
        formatter: (raw: unknown) => {
          const items = raw as { dataIndex: number }[]
          const i = items[0]?.dataIndex ?? 0
          return (
            tooltipHeader(`Spot ${fixed(data.spots[i], 2)}`) +
            tooltipRow(c.series1, fixed(data.value[i], 4), 'Value today') +
            tooltipRow(c.series2, fixed(data.payoff[i], 4), 'Payoff at expiry')
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
        splitLine: { show: false },
      },
      yAxis: { type: 'value', name: 'Value', ...axis },
      series: [
        {
          name: 'Payoff at expiry',
          type: 'line',
          data: payoff,
          showSymbol: false,
          lineStyle: { width: 2, color: c.series2 },
          itemStyle: { color: c.series2 },
          z: 1,
        },
        {
          name: 'Value today',
          type: 'line',
          data: today,
          showSymbol: false,
          lineStyle: { width: 2, color: c.series1 },
          itemStyle: { color: c.series1 },
          z: 2,
          markLine: {
            silent: true,
            symbol: 'none',
            lineStyle: { color: c.axis, width: 1, type: 'solid' },
            label: { color: c.muted, fontSize: 11, formatter: '{b}' },
            data: [{ name: 'Strike', xAxis: params.strike }],
          },
          // Today's spot: a dot on the curve with a surface-coloured ring.
          markPoint: {
            silent: true,
            symbol: 'circle',
            symbolSize: 10,
            itemStyle: { color: c.series1, borderColor: c.surface, borderWidth: 2 },
            label: { show: false },
            data: atSpot == null ? [] : [{ name: 'Spot', coord: [params.spot, atSpot] }],
          },
        },
      ],
    }
  }, [data, c, params.strike, params.spot])

  return (
    <ChartCard
      title="Value across spot"
      description={`Today's value versus the payoff at expiry. The gap is time value; the dot is today's spot. ${data ? `Engine: ${data.engine_label}.` : ''}`}
      action={
        <div className="flex gap-4">
          <LegendKey color={c.series1} label="Value today" />
          <LegendKey color={c.series2} label="Payoff at expiry" />
        </div>
      }
      stale={stale}
    >
      {option ? (
        <EChart
          option={option}
          ariaLabel="Line chart of option value today and payoff at expiry across spot prices"
        />
      ) : (
        <div className="h-72" />
      )}
    </ChartCard>
  )
}
