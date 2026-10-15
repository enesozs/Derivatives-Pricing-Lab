import { lazy } from 'react'

// Each page is its own chunk. The loaders are also called on nav hover/focus to preload.
export const loadPricer = () => import('./pricer/pricer-page')
export const loadImpliedVol = () => import('./implied-vol/implied-vol-page')
export const loadStrategies = () => import('./strategies/strategies-page')

export const PricerPage = lazy(loadPricer)
export const ImpliedVolPage = lazy(loadImpliedVol)
export const StrategiesPage = lazy(loadStrategies)
