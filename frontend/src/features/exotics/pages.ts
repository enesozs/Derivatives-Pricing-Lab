import { lazy } from 'react'

export const loadExoticPricer = () => import('./pricer/exotic-pricer-page')
export const loadAmerican = () => import('./american/american-page')

export const ExoticPricerPage = lazy(loadExoticPricer)
export const AmericanPage = lazy(loadAmerican)
