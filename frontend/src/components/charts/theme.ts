import { useTheme, type Theme } from '@/lib/theme'

// dataviz reference palette, validated (scripts/validate_palette.js) for both surfaces:
// slots 1-3 (blue, orange, aqua) pass all-pairs CVD and normal-vision checks in both modes.
// Light-mode aqua is below 3:1 contrast, so charts using series3 carry direct labels.
// Diverging (P&L heatmaps): red <-> neutral grey <-> blue, never a hue at the midpoint.
const PALETTE = {
  light: {
    series1: '#2a78d6',
    series2: '#eb6834',
    series3: '#1baf7a',
    band: 'rgba(42, 120, 214, 0.12)',
    diverging: ['#b83232', '#e88b89', '#f0efec', '#86b6ef', '#1c5cab'],
    // Ordinal blue ramp (ordered series, e.g. dates); ends kept >= 2:1 against the surface.
    ordinal: ['#86b6ef', '#5598e7', '#2a78d6', '#1c5cab', '#0d366b'],
    ink: '#0b0b0b',
    ink2: '#52514e',
    muted: '#898781',
    grid: '#e1e0d9',
    axis: '#c3c2b7',
    surface: '#ffffff',
    tooltip: '#ffffff',
    tooltipBorder: 'rgba(11, 11, 11, 0.10)',
  },
  dark: {
    series1: '#3987e5',
    series2: '#d95926',
    series3: '#199e70',
    band: 'rgba(57, 135, 229, 0.16)',
    diverging: ['#e66767', '#8a4241', '#383835', '#2f5f9c', '#5598e7'],
    ordinal: ['#184f95', '#256abf', '#3987e5', '#6da7ec', '#b7d3f6'],
    ink: '#f0efec',
    ink2: '#c3c2b7',
    muted: '#898781',
    grid: '#2c2c2a',
    axis: '#383835',
    surface: '#1a1a1a',
    tooltip: '#1f1f1e',
    tooltipBorder: 'rgba(255, 255, 255, 0.10)',
  },
} as const satisfies Record<Theme, Record<string, string | readonly string[]>>

export type ChartColors = (typeof PALETTE)[Theme]

export function useChartColors(): ChartColors {
  return PALETTE[useTheme().theme]
}

export const FONT_FAMILY = "'Inter Variable', system-ui, sans-serif"

/** Shared axis chrome: hairline solid grid, muted labels, no ticks. */
export function axisStyle(c: ChartColors) {
  return {
    axisLine: { lineStyle: { color: c.axis } },
    axisTick: { show: false },
    axisLabel: { color: c.muted, fontSize: 11, fontFamily: FONT_FAMILY },
    splitLine: { lineStyle: { color: c.grid, type: 'solid' as const, width: 1 } },
    nameTextStyle: { color: c.muted, fontSize: 11, fontFamily: FONT_FAMILY },
  }
}

export function tooltipStyle(c: ChartColors) {
  return {
    trigger: 'axis' as const,
    backgroundColor: c.tooltip,
    borderColor: c.tooltipBorder,
    borderWidth: 1,
    padding: [8, 10],
    textStyle: { color: c.ink, fontFamily: FONT_FAMILY, fontSize: 12 },
    extraCssText: 'border-radius: 8px; box-shadow: 0 4px 16px rgba(0,0,0,0.12);',
    axisPointer: {
      type: 'line' as const,
      lineStyle: { color: c.muted, width: 1, type: 'solid' as const },
    },
  }
}

/** One tooltip row: value first (strong), series name second, keyed by a short line stroke. */
export function tooltipRow(color: string, value: string, name: string): string {
  return (
    `<div style="display:flex;align-items:center;gap:8px;line-height:20px">` +
    `<span style="display:inline-block;width:12px;height:2px;border-radius:1px;background:${color}"></span>` +
    `<span style="font-weight:600;font-variant-numeric:tabular-nums">${value}</span>` +
    `<span style="opacity:.7">${name}</span></div>`
  )
}

export function tooltipHeader(text: string): string {
  return `<div style="opacity:.7;margin-bottom:2px">${text}</div>`
}

// Bottom margin leaves room for the x-axis title (containLabel only covers tick labels).
export const GRID = { left: 8, right: 16, top: 36, bottom: 30, containLabel: true }
