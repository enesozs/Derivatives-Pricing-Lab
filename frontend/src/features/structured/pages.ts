import { lazy } from 'react'

export const loadAutocallable = () => import('./autocallable-page')
export const loadReverseConvertible = () => import('./reverse-convertible-page')
export const loadVariance = () => import('./variance-page')
export const loadCliquet = () => import('./cliquet-page')
export const loadRisk = () => import('./risk-page')

export const AutocallablePage = lazy(loadAutocallable)
export const ReverseConvertiblePage = lazy(loadReverseConvertible)
export const VariancePage = lazy(loadVariance)
export const CliquetPage = lazy(loadCliquet)
export const RiskPage = lazy(loadRisk)
