import { lazy } from 'react'

export const loadCds = () => import('./cds-page')
export const loadXva = () => import('./xva-page')

export const CdsPage = lazy(loadCds)
export const XvaPage = lazy(loadXva)
