import { lazy } from 'react'

// Each page is its own chunk. The loaders are also called on nav hover/focus to preload.
export const loadPricer = () => import('./pricer/pricer-page')
export const loadImpliedVol = () => import('./implied-vol/implied-vol-page')
export const loadMethods = () => import('./methods/methods-page')
export const loadStrategies = () => import('./strategies/strategies-page')
export const loadHedging = () => import('./hedging/hedging-page')

export const PricerPage = lazy(loadPricer)
export const ImpliedVolPage = lazy(loadImpliedVol)
export const MethodsPage = lazy(loadMethods)
export const StrategiesPage = lazy(loadStrategies)
export const HedgingPage = lazy(loadHedging)
