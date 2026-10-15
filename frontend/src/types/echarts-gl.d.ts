// echarts-gl ships without TypeScript types; these are the two installers we use.
declare module 'echarts-gl/components' {
  type Installer = Parameters<typeof import('echarts/core').use>[0]
  export const Grid3DComponent: Installer
}
declare module 'echarts-gl/charts' {
  type Installer = Parameters<typeof import('echarts/core').use>[0]
  export const SurfaceChart: Installer
}
