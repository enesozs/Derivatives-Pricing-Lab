import * as echarts from 'echarts/core'
import { useEffect, useRef, useState } from 'react'
import { ChartCard } from '@/components/charts/chart-card'
import { FONT_FAMILY, useChartColors } from '@/components/charts/theme'
import { Segmented } from '@/components/segmented'
import type { SurfaceResponse } from '@/lib/api'
import { fixed } from '@/lib/format'
import { cn } from '@/lib/utils'

type Layer = 'implied' | 'local'

// WebGL code is large: load it only when this chart is shown.
let glReady: Promise<void> | null = null
function loadGL(): Promise<void> {
  glReady ??= Promise.all([import('echarts-gl/components'), import('echarts-gl/charts')]).then(
    ([components, charts]) => {
      echarts.use(components.Grid3DComponent)
      echarts.use(charts.SurfaceChart)
    },
  )
  return glReady
}

export function Surface3D({
  grid,
  stale,
}: {
  grid: SurfaceResponse['grid'] | undefined
  stale: boolean
}) {
  const c = useChartColors()
  const [layer, setLayer] = useState<Layer>('implied')
  const container = useRef<HTMLDivElement>(null)
  const chart = useRef<echarts.ECharts | null>(null)
  const [ready, setReady] = useState(false)

  useEffect(() => {
    let cancelled = false
    void loadGL().then(() => {
      if (cancelled || !container.current) return
      chart.current = echarts.init(container.current)
      setReady(true)
    })
    const element = container.current
    const observer = new ResizeObserver(() => chart.current?.resize())
    if (element) observer.observe(element)
    return () => {
      cancelled = true
      observer.disconnect()
      chart.current?.dispose()
      chart.current = null
    }
  }, [])

  useEffect(() => {
    if (!ready || !chart.current || !grid) return
    const values = layer === 'implied' ? grid.implied_vol : grid.local_vol
    const data: number[][] = []
    grid.maturities.forEach((t, i) =>
      grid.log_moneyness.forEach((k, j) => data.push([Math.exp(k) * 100, t, values[i][j] * 100])),
    )
    const all = data.map((d) => d[2])
    const axisCommon = {
      nameTextStyle: { color: c.muted, fontFamily: FONT_FAMILY, fontSize: 11 },
      axisLabel: { color: c.muted, fontFamily: FONT_FAMILY, fontSize: 10 },
      axisLine: { lineStyle: { color: c.axis } },
      splitLine: { lineStyle: { color: c.grid } },
      axisPointer: { lineStyle: { color: c.muted } },
    }
    chart.current.setOption(
      {
        tooltip: {
          backgroundColor: c.tooltip,
          borderColor: c.tooltipBorder,
          textStyle: { color: c.ink, fontFamily: FONT_FAMILY, fontSize: 12 },
          formatter: (p: { value: number[] }) =>
            `Strike ${fixed(p.value[0], 0)}% of forward · ${fixed(p.value[1], 2)}y<br/><b>${fixed(p.value[2], 2)}%</b> ${layer === 'implied' ? 'implied' : 'local'} vol`,
        },
        visualMap: {
          show: false,
          dimension: 2,
          min: Math.min(...all),
          max: Math.max(...all),
          inRange: { color: [...c.ordinal] },
        },
        grid3D: {
          boxWidth: 110,
          boxDepth: 80,
          boxHeight: 60,
          viewControl: { alpha: 22, beta: 38, distance: 190, rotateSensitivity: 1.2 },
          light: { main: { intensity: 1.1, shadow: false }, ambient: { intensity: 0.35 } },
          environment: 'none',
        },
        xAxis3D: {
          type: 'value',
          name: 'Strike (% of fwd)',
          min: 'dataMin',
          max: 'dataMax',
          ...axisCommon,
          axisLabel: { ...axisCommon.axisLabel, formatter: (v: number) => fixed(v, 0) },
        },
        yAxis3D: {
          type: 'value',
          name: 'Years',
          min: 0,
          max: 'dataMax',
          ...axisCommon,
          axisLabel: { ...axisCommon.axisLabel, formatter: (v: number) => fixed(v, 1) },
        },
        zAxis3D: {
          type: 'value',
          name: 'Vol %',
          min: Math.floor(Math.min(...all) / 5) * 5,
          max: Math.ceil(Math.max(...all) / 5) * 5,
          ...axisCommon,
        },
        series: [
          {
            type: 'surface',
            data,
            shading: 'lambert',
            wireframe: { show: true, lineStyle: { color: c.surface, width: 0.5, opacity: 0.6 } },
            dataShape: [grid.maturities.length, grid.log_moneyness.length],
          },
        ],
      },
      true,
    )
  }, [ready, grid, layer, c])

  return (
    <ChartCard
      title="The volatility surface"
      description={
        layer === 'implied'
          ? 'Implied volatility across strike and maturity, from the SVI fits interpolated in total variance. Drag to rotate.'
          : `Dupire local volatility: the instantaneous volatility at each spot and date that reproduces every option price. Steeper than the implied skew, as theory predicts.${grid?.local_vol_fallbacks ? ` (${grid.local_vol_fallbacks} grid points with arbitrage fall back to implied vol.)` : ''}`
      }
      action={
        <Segmented<Layer>
          label="Surface"
          size="sm"
          value={layer}
          onChange={setLayer}
          options={[
            { value: 'implied', label: 'Implied' },
            { value: 'local', label: 'Local (Dupire)' },
          ]}
        />
      }
      stale={stale}
    >
      <div
        ref={container}
        role="img"
        aria-label="Three-dimensional volatility surface across strike and maturity"
        className={cn('h-[28rem] w-full', !ready && 'animate-pulse rounded-xl bg-muted')}
      />
    </ChartCard>
  )
}
