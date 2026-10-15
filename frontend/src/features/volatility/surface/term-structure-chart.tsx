import { useMemo } from 'react'
import { ChartCard } from '@/components/charts/chart-card'
import { EChart, type ChartOption } from '@/components/charts/echart'
import {
  axisStyle,
  GRID,
  tooltipHeader,
  tooltipRow,
  tooltipStyle,
  useChartColors,
} from '@/components/charts/theme'
import type { SurfaceSlice } from '@/lib/api'
import { fixed } from '@/lib/format'
import { expiryLabel } from '../format'

export function TermStructureChart({
  slices,
  stale,
}: {
  slices: SurfaceSlice[] | undefined
  stale: boolean
}) {
  const c = useChartColors()
  const option = useMemo<ChartOption | null>(() => {
    if (!slices) return null
    const axis = axisStyle(c)
    return {
      animationDurationUpdate: 200,
      grid: GRID,
      tooltip: {
        ...tooltipStyle(c),
        formatter: (raw: unknown) => {
          const i = (raw as { dataIndex: number }[])[0]?.dataIndex ?? 0
          const s = slices[i]
          return (
            tooltipHeader(`${expiryLabel(s.expiry)} · ${fixed(s.t, 2)}y`) +
            tooltipRow(c.series1, `${fixed(s.atm_vol * 100, 2)}%`, 'At-the-money vol')
          )
        },
      },
      xAxis: {
        type: 'value',
        name: 'Years to expiry',
        nameLocation: 'middle',
        nameGap: 28,
        min: 0,
        ...axis,
        splitLine: { show: false },
      },
      yAxis: {
        type: 'value',
        name: 'ATM implied vol (%)',
        scale: true,
        ...axis,
        axisLabel: { ...axis.axisLabel, formatter: (v: number) => fixed(v, 0) },
      },
      series: [
        {
          name: 'At-the-money vol',
          type: 'line',
          data: slices.map((s) => [s.t, s.atm_vol * 100]),
          symbol: 'circle',
          symbolSize: 8,
          lineStyle: { width: 2, color: c.series1 },
          itemStyle: { color: c.series1, borderColor: c.surface, borderWidth: 2 },
        },
      ],
    }
  }, [slices, c])

  return (
    <ChartCard
      title="Term structure"
      description="At-the-money implied volatility by maturity. Upward-sloping is the calm-market norm; inverted means the market expects turbulence soon."
      stale={stale}
    >
      {option ? (
        <EChart
          option={option}
          className="h-80"
          ariaLabel="At-the-money implied volatility against maturity"
        />
      ) : (
        <div className="h-80" />
      )}
    </ChartCard>
  )
}
