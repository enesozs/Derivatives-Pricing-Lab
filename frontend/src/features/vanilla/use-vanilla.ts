import { keepPreviousData, useQuery } from '@tanstack/react-query'
import { useMemo } from 'react'
import { useDebouncedValue } from '@/hooks/use-debounced-value'
import { api } from '@/lib/api'
import { toInputs, toPriceRequest, type VanillaParams } from './params'

/** Fetches price, spot profile and convergence for the (debounced) parameters. */
export function useVanilla(params: VanillaParams) {
  const settled = useDebouncedValue(params, 150)
  const inputs = useMemo(() => toInputs(settled), [settled])
  const priceRequest = useMemo(() => toPriceRequest(settled), [settled])

  const price = useQuery({
    queryKey: ['vanilla', 'price', priceRequest],
    queryFn: ({ signal }) => api.price(priceRequest, signal),
    placeholderData: keepPreviousData,
  })
  const profile = useQuery({
    queryKey: ['vanilla', 'profile', inputs],
    queryFn: ({ signal }) => api.profile(inputs, signal),
    placeholderData: keepPreviousData,
  })
  const convergence = useQuery({
    queryKey: ['vanilla', 'convergence', inputs],
    queryFn: ({ signal }) => api.convergence(inputs, signal),
    placeholderData: keepPreviousData,
  })

  return { settled, price, profile, convergence }
}
