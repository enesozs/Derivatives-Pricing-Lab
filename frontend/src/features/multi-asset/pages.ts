import { lazy } from 'react'

export const loadCorrelation = () => import('./correlation-page')
export const loadQuanto = () => import('./quanto-page')

export const CorrelationPage = lazy(loadCorrelation)
export const QuantoPage = lazy(loadQuanto)
