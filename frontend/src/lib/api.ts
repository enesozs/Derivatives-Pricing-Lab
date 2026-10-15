// Typed client for the FastAPI backend. Types mirror backend/src/derivlab_api/schemas.py;
// keep them in sync when the schemas change.

export type OptionKind = 'call' | 'put'
export type ExerciseStyle = 'european' | 'american'

/** Library units: decimals for rates/vol, years for expiry. */
export interface VanillaInputs {
  kind: OptionKind
  exercise: ExerciseStyle
  strike: number
  expiry: number
  spot: number
  rate: number
  dividend_yield: number
  volatility: number
}

export interface PriceRequest extends VanillaInputs {
  tree_steps: number
  mc_paths: number
  seed: number
}

export interface Greeks {
  delta: number
  gamma: number
  vega: number
  theta: number
  rho: number
}

export type MethodId = 'analytic' | 'crr' | 'monte_carlo'

export interface MethodResult {
  method: MethodId
  label: string
  status: 'ok' | 'unsupported' | 'error'
  value: number | null
  stderr: number | null
  ci_low: number | null
  ci_high: number | null
  abs_error: number | null
  runtime_ms: number | null
  note: string | null
}

export interface PriceResponse {
  reference: number
  reference_label: string
  greeks: Greeks | null
  greeks_label: string
  methods: MethodResult[]
}

export interface ProfileResponse {
  engine_label: string
  spots: number[]
  value: number[]
  payoff: number[]
  delta: (number | null)[]
  gamma: (number | null)[]
  vega: (number | null)[]
  theta: (number | null)[]
  rho: (number | null)[]
}

export interface ConvergenceResponse {
  reference: number
  reference_label: string
  lattice: { steps: number; value: number; abs_error: number }[]
  monte_carlo: { paths: number; value: number; stderr: number }[]
  monte_carlo_note: string | null
}

export class ApiError extends Error {}

async function post<T>(path: string, body: unknown, signal?: AbortSignal): Promise<T> {
  let response: Response
  try {
    response = await fetch(`/api${path}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal,
    })
  } catch (error) {
    if (signal?.aborted) throw error
    throw new ApiError('Cannot reach the pricing API. Is the backend running?')
  }
  if (!response.ok) {
    const detail = await response.json().catch(() => null)
    const message =
      typeof detail?.detail === 'string' ? detail.detail : `Request failed (${response.status})`
    throw new ApiError(message)
  }
  return (await response.json()) as T
}

export const api = {
  price: (req: PriceRequest, signal?: AbortSignal) =>
    post<PriceResponse>('/vanilla/price', req, signal),
  profile: (req: VanillaInputs, signal?: AbortSignal) =>
    post<ProfileResponse>('/vanilla/profile', req, signal),
  convergence: (req: VanillaInputs, signal?: AbortSignal) =>
    post<ConvergenceResponse>('/vanilla/convergence', req, signal),
}
