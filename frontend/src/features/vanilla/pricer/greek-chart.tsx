import { useMemo, useState } from 'react'
import { EChart, type ChartOption } from '@/components/charts/echart'
import {
  axisStyle,
  GRID,
  tooltipHeader,
  tooltipRow,
  tooltipStyle,
  useChartColors,
} from '@/components/charts/theme'
import { Segmented } from '@/components/segmented'
import { interpolate } from '@/components/charts/interpolate'
import type { Greeks, ProfileResponse } from '@/lib/api'
import { fixed, signed } from '@/lib/format'
import { ChartCard } from '@/components/charts/chart-card'
import { GREEKS } from '@/lib/greeks'
import type { VanillaParams } from './params'

interface GreekChartProps {
  params: VanillaParams
  data: ProfileResponse | undefined
  stale: boolean
}

export function GreekChart({ params, data, stale }: GreekChartProps) {
  const c = useChartColors()
  const [greek, setGreek] = useState<keyof Greeks>('delta')
  const meta = GREEKS.find((g) => g.key === greek) ?? GREEKS[0]

  const option = useMemo<ChartOption | null>(() => {
    if (!data) return null
    const values = data[greek].map((v) => (v == null ? null : v * meta.scale))
    const axis = axisStyle(c)
    const atSpot = interpolate(data.spots, values, params.spot)
    return {
      animationDurationUpdate: 200,
      grid: GRID,
      tooltip: {
        ...tooltipStyle(c),
        formatter: (raw: unknown) => {
          const i = (raw as { dataIndex: number }[])[0]?.dataIndex ?? 0
          return (
            tooltipHeader(`Spot ${fixed(data.spots[i], 2)}`) +
            tooltipRow(c.series1, signed(values[i], 4), meta.label)
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
      yAxis: { type: 'value', name: meta.unit, ...axis },
      series: [
        {
          name: meta.label,
          type: 'line',
          data: data.spots.map((s, i) => [s, values[i]]),
          showSymbol: false,
          connectNulls: false,
          lineStyle: { width: 2, color: c.series1 },
          itemStyle: { color: c.series1 },
          areaStyle: { color: c.band },
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
  }, [data, c, greek, meta, params.strike, params.spot])

  return (
    <ChartCard
      title={`${meta.label} across spot`}
      description={meta.description}
      action={
        <Segmented<keyof Greeks>
          label="Greek"
          size="sm"
          value={greek}
          onChange={setGreek}
          options={GREEKS.map((g) => ({ value: g.key, label: g.label }))}
        />
      }
      stale={stale}
    >
      {option ? (
        <EChart option={option} ariaLabel={`Line chart of ${meta.label} across spot prices`} />
      ) : (
        <div className="h-72" />
      )}
    </ChartCard>
  )
}
