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
  /** PDE space steps; time steps are half of this. */
  pde_space_steps: number
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

export type MethodId = 'analytic' | 'crr' | 'leisen_reimer' | 'pde' | 'monte_carlo'

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
  greeks: Greeks | null
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

export interface ConvergencePoint {
  /** Tree steps, or PDE space steps. */
  steps: number
  value: number
  abs_error: number
}

export interface ConvergenceResponse {
  reference: number
  reference_label: string
  crr: ConvergencePoint[]
  leisen_reimer: ConvergencePoint[]
  pde: ConvergencePoint[]
  monte_carlo: { paths: number; value: number; stderr: number }[]
  monte_carlo_note: string | null
}

export type TreeScheme = 'crr' | 'jarrow-rudd' | 'leisen-reimer'

export interface TreeRequest extends VanillaInputs {
  steps: number
  scheme: TreeScheme
}

export interface TreeNode {
  level: number
  index: number
  spot: number
  value: number
  exercised: boolean
}

export interface TreeResponse {
  steps: number
  dt: number
  up: number
  down: number
  probability: number
  nodes: TreeNode[]
}

export interface PDEGridResponse {
  spots: number[]
  payoff: number[]
  slices: { time: number; values: number[] }[]
  boundary_times: number[]
  boundary_spots: (number | null)[]
}

export interface HedgeRequest {
  kind: OptionKind
  strike: number
  expiry: number
  spot: number
  rate: number
  dividend_yield: number
  realised_volatility: number
  hedge_volatility: number
  position: 'short' | 'long'
  rebalances: number
  cost_bps: number
  paths: number
  seed: number
}

export interface Distribution {
  mean: number
  std: number
  p05: number
  p95: number
}

export interface HedgeResponse {
  premium: number
  hedged: Distribution
  unhedged: Distribution
  approx_std: number
  mean_cost: number
  histogram: { edges: number[]; counts: number[] }
  sample_times: number[]
  sample_spots: number[][]
  sample_pnl: number[][]
  frequency: {
    rebalances: number
    mean: number
    std: number
    approx_std: number
    mean_cost: number
  }[]
}

export interface ImpliedVolRequest {
  kind: OptionKind
  exercise: ExerciseStyle
  strike: number
  expiry: number
  spot: number
  rate: number
  dividend_yield: number
  /** Observed option price per unit. */
  price: number
}

export interface ImpliedVolResponse {
  implied_vol: number | null
  iterations: number | null
  residual: number | null
  /** Why no implied volatility exists, when it does not. */
  message: string | null
  engine_label: string
  price_lower: number
  price_upper: number
  curve_vols: number[]
  curve_prices: number[]
}

export interface LegInput {
  kind: OptionKind
  exercise: ExerciseStyle
  strike: number
  expiry: number
  /** Positive = long (bought), negative = short (sold). */
  quantity: number
}

export interface StrategyRequest {
  spot: number
  rate: number
  dividend_yield: number
  volatility: number
  legs: LegInput[]
  underlying_quantity: number
}

export interface StrategyResponse {
  /** Cost to enter: positive = debit paid, negative = credit received. */
  net_value: number
  greeks: Greeks | null
  legs: { unit_value: number; position_value: number; greeks: Greeks | null }[]
  engine_label: string
  horizon: number
  spots: number[]
  pnl_today: number[]
  pnl_horizon: number[]
  breakevens: number[]
  /** null = unbounded. */
  max_profit: number | null
  max_loss: number | null
}

export interface ScenarioRequest extends StrategyRequest {
  /** Years from today at which to revalue. */
  elapsed: number
}

export interface ScenarioResponse {
  elapsed: number
  spots: number[]
  vol_shifts: number[]
  /** pnl[i][j]: P&L with volatility shifted by vol_shifts[i] at spots[j]. */
  pnl: number[][]
}

// --- Volatility -------------------------------------------------------------------------------

export type SourceKind = 'snapshot' | 'synthetic' | 'live'

export interface SourceRequest {
  source: SourceKind
  snapshot?: string | null
  ticker: string
  /** Risk-free rate for discounting; forwards come from put–call parity. */
  rate: number
}

export interface SourcesResponse {
  snapshots: { id: string; ticker: string; as_of: string; description: string }[]
  live_available: boolean
}

export interface SmilePoint {
  strike: number
  log_moneyness: number
  implied_vol: number
  kind: OptionKind
  price_source: 'mid' | 'last'
}

export interface SVIFitOut {
  a: number
  b: number
  rho: number
  m: number
  sigma: number
  rmse: number
  butterfly_violations: number
  k_min: number
  k_max: number
}

export interface SurfaceSlice {
  expiry: string
  t: number
  forward: number
  discount: number
  forward_method: 'parity' | 'fallback'
  atm_vol: number
  dropped: Record<string, number>
  points: SmilePoint[]
  svi: SVIFitOut
  fit_k: number[]
  fit_vol: number[]
}

export interface SurfaceResponse {
  meta: {
    ticker: string
    spot: number
    as_of: string
    source: SourceKind
    description: string
    synthetic: boolean
    price_basis: 'mid' | 'last' | 'mixed'
  }
  slices: SurfaceSlice[]
  calendar_violations: { t_short: number; t_long: number; count: number }[]
  grid: {
    log_moneyness: number[]
    maturities: number[]
    implied_vol: number[][]
    local_vol: number[][]
    local_vol_fallbacks: number
  }
}

export type CalibrationModel = 'heston' | 'sabr'

export interface CalibrationRequest extends SourceRequest {
  model: CalibrationModel
  beta: number
}

export interface CalibrationResponse {
  model: CalibrationModel
  parameters: Record<string, number>[]
  rmse: number
  runtime_ms: number
  feller_satisfied: boolean | null
  slices: {
    expiry: string
    t: number
    forward: number
    strikes: number[]
    log_moneyness: number[]
    market_vol: number[]
    model_vol: (number | null)[]
    rmse: number
  }[]
}

export type ModelParams =
  | { model: 'black_scholes'; volatility: number }
  | { model: 'heston'; v0: number; kappa: number; theta: number; xi: number; rho: number }
  | {
      model: 'merton'
      volatility: number
      intensity: number
      jump_mean: number
      jump_volatility: number
    }
  | { model: 'sabr'; alpha: number; beta: number; rho: number; nu: number }

export interface ModelSmileRequest {
  params: ModelParams
  spot: number
  rate: number
  dividend_yield: number
  expiries: number[]
}

export interface ModelSmileResponse {
  model: string
  density_spots: number[]
  smiles: {
    t: number
    strikes: number[]
    implied_vol: (number | null)[]
    density: number[] | null
  }[]
  reference_density: number[]
}

// --- Exotics ---------------------------------------------------------------------------------

export type ProductSpec =
  | {
      type: 'digital'
      kind: OptionKind
      strike: number
      expiry: number
      payout: 'cash' | 'asset'
      cash: number
    }
  | {
      type: 'barrier'
      kind: OptionKind
      strike: number
      expiry: number
      barrier: number
      direction: 'up' | 'down'
      knock: 'in' | 'out'
      /** null = continuous monitoring. */
      observations: number | null
    }
  | {
      type: 'asian'
      kind: OptionKind
      strike: number
      expiry: number
      fixings: number
      averaging: 'arithmetic' | 'geometric'
      strike_type: 'fixed' | 'floating'
    }
  | {
      type: 'lookback'
      kind: OptionKind
      expiry: number
      strike_type: 'fixed' | 'floating'
      strike: number
      observations: number | null
    }

export type ExoticModelSpec =
  | { type: 'black_scholes'; volatility: number }
  | { type: 'heston'; v0: number; kappa: number; theta: number; xi: number; rho: number }

export interface ExoticRequest {
  product: ProductSpec
  spot: number
  rate: number
  dividend_yield: number
  model: ExoticModelSpec
  mc_paths: number
  seed: number
}

export interface ExoticMethod {
  method: 'analytic' | 'monte_carlo' | 'pde'
  label: string
  status: 'ok' | 'unsupported' | 'error'
  value: number | null
  stderr: number | null
  ci_low: number | null
  ci_high: number | null
  runtime_ms: number | null
  note: string | null
}

export interface ExoticPriceResponse {
  value: number
  value_label: string
  vanilla_value: number | null
  greeks: Greeks | null
  greeks_label: string | null
  methods: ExoticMethod[]
}

export interface ExoticProfileResponse {
  engine_label: string
  spots: number[]
  value: number[]
  delta: number[]
  vanilla_value: number[] | null
  vanilla_delta: number[] | null
}

export interface ExoticPathsResponse {
  times: number[]
  paths: number[][]
  payoffs: number[]
  hit: boolean[] | null
  fixing_times: number[] | null
  averages: number[] | null
  extremes: number[][] | null
}

export interface AmericanMCRequest {
  kind: OptionKind
  strike: number
  expiry: number
  spot: number
  rate: number
  dividend_yield: number
  model: ExoticModelSpec
  paths: number
  exercise_dates: number
  degree: number
}

export interface AmericanMCResponse {
  lsm_value: number
  lsm_stderr: number
  reference_value: number | null
  reference_label: string | null
  european_value: number
  exercise_times: number[]
  lsm_boundary: (number | null)[]
  reference_times: number[]
  reference_boundary: (number | null)[]
  exercise_points: number[][]
  convergence: { paths: number; value: number; stderr: number }[]
  runtime_ms: number
}

// --- Multi-asset ------------------------------------------------------------------------------

export type MultiAssetProduct = 'exchange' | 'spread' | 'basket' | 'best_of' | 'worst_of'

export interface MultiAssetRequest {
  product: MultiAssetProduct
  kind: OptionKind
  strike: number
  expiry: number
  rate: number
  assets: { spot: number; volatility: number; dividend_yield: number }[]
  correlation: number
  mc_paths: number
  seed: number
}

export interface MultiAssetResponse {
  value: number
  value_label: string
  methods: {
    label: string
    status: 'ok' | 'unsupported' | 'error'
    value: number | null
    stderr: number | null
    runtime_ms: number | null
    note: string | null
  }[]
  correlation_sensitivity: number
  correlation_grid: number[]
  correlation_values: number[]
  correlation_engine: string
  scatter_x: number[]
  scatter_y: number[]
  scatter_pays: boolean[]
}

export interface QuantoRequest {
  kind: OptionKind
  strike: number
  expiry: number
  spot: number
  domestic_rate: number
  foreign_rate: number
  dividend_yield: number
  asset_volatility: number
  fx_volatility: number
  correlation: number
  fixed_fx: number
  mc_paths: number
}

export interface QuantoResponse {
  value: number
  mc_value: number
  mc_stderr: number
  uncorrelated_value: number
  drift_adjustment: number
  correlation_grid: number[]
  correlation_values: number[]
}

// --- Rates ------------------------------------------------------------------------------------

export interface RateQuote {
  kind: 'deposit' | 'fra' | 'swap'
  maturity: number
  rate: number
  start: number
  frequency: number
}

export interface CurveResponse {
  node_labels: string[]
  node_times: number[]
  node_discount: number[]
  node_zero: number[]
  repricing_errors: number[]
  grid: number[]
  zero: number[]
  forward: number[]
  discount: number[]
  par_tenors: number[]
  par_rates: number[]
}

export interface SwapResponse {
  fixed_rate: number
  par_rate: number
  npv: number
  annuity: number
  dv01: number
  cash_flows: { time: number; fixed: number; floating: number; discount: number }[]
  shifts_bp: number[]
  shifted_npv: number[]
}

export interface BondResponse {
  price: number
  yield_to_maturity: number
  macaulay_duration: number
  modified_duration: number
  convexity: number
  dv01: number
  yields: number[]
  exact: number[]
  duration_approx: number[]
  convexity_approx: number[]
}

export interface RateOptionResponse {
  price: number
  strike: number
  atm_forward: number
  equivalent_vol: number | null
  caplets: { fixing: number; payment: number; forward: number; value: number }[] | null
  smile_strikes: number[]
  smile_black: number[]
  smile_from_normal: (number | null)[]
}

export interface Fan {
  times: number[]
  p05: number[]
  p25: number[]
  p50: number[]
  p75: number[]
  p95: number[]
}

export interface ShortRateResponse {
  hull_white: Fan
  vasicek: Fan
  market_zero_times: number[]
  market_zero: number[]
  vasicek_zero: number[]
  hull_white_zero: number[]
  swaption_strike: number
  european_jamshidian: number
  european_tree: number
  bermudan_tree: number
}

export interface HWCalibrationResponse {
  a: number
  sigma: number
  rmse: number
  maturities: number[]
  market_vols: number[]
  model_vols: number[]
}

export interface CurveRequest {
  quotes: RateQuote[]
}

export interface SwapRequest extends CurveRequest {
  maturity: number
  /** null = the par rate (a swap worth zero today). */
  fixed_rate: number | null
  frequency: number
  notional: number
  payer: boolean
}

export interface BondRequest extends CurveRequest {
  coupon: number
  maturity: number
  frequency: number
}

export interface RateOptionRequest extends CurveRequest {
  product: 'cap' | 'floor' | 'payer' | 'receiver'
  /** null = at the money. */
  strike: number | null
  maturity: number
  expiry: number
  tenor: number
  frequency: number
  vol_model: 'black' | 'bachelier'
  vol: number
  notional: number
}

export interface ShortRateRequest extends CurveRequest {
  a: number
  sigma: number
  vasicek_b: number
  horizon: number
  swaption_expiry: number
  swaption_tenor: number
}

export interface HWCalibrationRequest extends CurveRequest {
  maturities: number[]
  black_vols: number[]
}

// --- Structured products ---------------------------------------------------------------------

export interface Histogram {
  edges: number[]
  counts: number[]
}

export interface Curve {
  x: number[]
  y: number[]
}

export interface StructuredMarket {
  rate: number
  dividend_yield: number
}

export type StructuredModelSpec = ExoticModelSpec

export interface AutocallableRequest extends StructuredMarket {
  maturity: number
  frequency: 1 | 2 | 4 | 12
  coupon: number
  autocall_level: number
  coupon_barrier: number
  protection_barrier: number
  memory: boolean
  monitoring: 'maturity' | 'daily'
  non_call_periods: number
  assets: number
  correlation: number
  model: StructuredModelSpec
  paths: number
}

export interface AutocallableResponse {
  value: number
  stderr: number
  fair_coupon: number
  observation_times: number[]
  redemption_probabilities: number[]
  loss_probability: number
  expected_life: number
  principal_value: number
  coupon_annuity: number
  returns: Histogram
  coupon_vs_vol: Curve
  coupon_vs_correlation: Curve | null
}

export interface ReverseConvertibleRequest extends StructuredMarket {
  maturity: number
  coupon: number
  frequency: 1 | 2 | 4 | 12
  strike: number
  barrier: number | null
  model: StructuredModelSpec
}

export interface ReverseConvertibleResponse {
  bond: number
  coupons: number
  short_put: number
  value: number
  fair_coupon: number
  barrier_hit_probability: number | null
  final_levels: number[]
  redemption_hit: number[]
  redemption_not_hit: number[]
  coupon_total: number
  coupon_vs_vol: Curve
}

export type VarianceModelSpec =
  | ExoticModelSpec
  | {
      type: 'merton'
      volatility: number
      intensity: number
      jump_mean: number
      jump_volatility: number
    }

export interface VarianceRequest extends StructuredMarket {
  expiry: number
  n_strikes: number
  width: number
  model: VarianceModelSpec
  paths: number
}

export interface VarianceResponse {
  expected_variance: number
  replicated_variance: number
  forward: number
  strikes: number[]
  weights: number[]
  option_prices: number[]
  contributions: number[]
  implied_vols: (number | null)[]
  convergence: Curve
  simulated_variance: number
  simulated_variance_stderr: number
  fair_volatility: number
  fair_volatility_stderr: number
  convexity_adjustment: number
  realised_vols: Histogram
}

export interface CliquetRequest extends StructuredMarket {
  maturity: number
  periods: number
  local_floor: number | null
  local_cap: number | null
  global_floor: number | null
  global_cap: number | null
  volatility: number
  kappa: number
  xi: number
  rho: number
  paths: number
}

export interface ModelValue {
  value: number
  stderr: number
}

export interface CliquetResponse {
  black_scholes: ModelValue
  heston: ModelValue
  closed_form: number | null
  payoffs_black_scholes: Histogram
  payoffs_heston: Histogram
  value_vs_local_cap: Partial<Record<'black_scholes' | 'heston', Curve>>
  forward_start: Record<'black_scholes' | 'heston', ModelValue>
  forward_start_closed_form: number
}

export type RiskProduct =
  | 'call'
  | 'put'
  | 'digital_call'
  | 'digital_put'
  | 'down_in_put'
  | 'up_out_call'
  | 'reverse_convertible'
  | 'autocallable'

export interface PositionIn {
  product: RiskProduct
  strike: number
  barrier: number | null
  expiry: number
  quantity: number
  coupon: number
  label: string
}

export interface RiskRequest extends StructuredMarket {
  volatility: number
  positions: PositionIn[]
}

export interface PositionRisk {
  label: string
  value: number
  delta: number
  gamma: number
  vega: number
  rho: number
}

export interface RiskResponse {
  positions: PositionRisk[]
  total: PositionRisk
  spot_shifts: number[]
  vol_shifts: number[]
  grid: number[][]
  scenarios: { name: string; full: number; taylor: number }[]
}

// --- Credit ------------------------------------------------------------------------------------

export interface CDSQuoteIn {
  maturity: number
  spread: number
}

export interface CDSRequest {
  rate: number
  recovery: number
  quotes: CDSQuoteIn[]
  maturity: number
  coupon: number
  notional: number
}

export interface CDSResponse {
  nodes: {
    maturity: number
    spread: number
    hazard: number
    survival: number
    triangle_hazard: number
    repricing_error: number
  }[]
  grid: number[]
  survival: number[]
  hazard: number[]
  par_spread: number
  rpv01: number
  protection_leg: number
  upfront: number
  default_probability: number
  cs01: number
}

export interface XVARequest {
  rate: number
  a: number
  sigma: number
  maturity: number
  frequency: number
  payer: boolean
  fixed_rate: number | null
  notional: number
  counterparty_spread: number
  counterparty_recovery: number
  own_spread: number | null
  own_recovery: number
  threshold: number | null
  paths: number
}

export interface XVAResponse {
  fixed_rate: number
  swap_value: number
  times: number[]
  discounted_ee: number[]
  discounted_ene: number[]
  epe: number[]
  pfe95: number[]
  sample_values: number[][]
  cva: number
  dva: number
  bilateral: number
  cva_running_bp: number
  cva_by_time: number[]
  dva_by_time: number[]
  check_times: number[]
  check_simulated: number[]
  check_exact: number[]
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
  impliedVol: (req: ImpliedVolRequest, signal?: AbortSignal) =>
    post<ImpliedVolResponse>('/vanilla/implied-vol', req, signal),
  strategy: (req: StrategyRequest, signal?: AbortSignal) =>
    post<StrategyResponse>('/strategies/analyze', req, signal),
  scenarios: (req: ScenarioRequest, signal?: AbortSignal) =>
    post<ScenarioResponse>('/strategies/scenarios', req, signal),
  tree: (req: TreeRequest, signal?: AbortSignal) =>
    post<TreeResponse>('/vanilla/tree', req, signal),
  pdeGrid: (req: VanillaInputs, signal?: AbortSignal) =>
    post<PDEGridResponse>('/vanilla/pde-grid', req, signal),
  deltaHedge: (req: HedgeRequest, signal?: AbortSignal) =>
    post<HedgeResponse>('/hedging/delta', req, signal),
  volSources: async (signal?: AbortSignal): Promise<SourcesResponse> => {
    const response = await fetch('/api/volatility/sources', { signal })
    if (!response.ok) throw new ApiError(`Request failed (${response.status})`)
    return (await response.json()) as SourcesResponse
  },
  volSurface: (req: SourceRequest, signal?: AbortSignal) =>
    post<SurfaceResponse>('/volatility/surface', req, signal),
  calibrate: (req: CalibrationRequest, signal?: AbortSignal) =>
    post<CalibrationResponse>('/volatility/calibrate', req, signal),
  modelSmile: (req: ModelSmileRequest, signal?: AbortSignal) =>
    post<ModelSmileResponse>('/volatility/model-smile', req, signal),
  exoticPrice: (req: ExoticRequest, signal?: AbortSignal) =>
    post<ExoticPriceResponse>('/exotics/price', req, signal),
  exoticProfile: (req: ExoticRequest, signal?: AbortSignal) =>
    post<ExoticProfileResponse>('/exotics/profile', req, signal),
  exoticPaths: (req: ExoticRequest, signal?: AbortSignal) =>
    post<ExoticPathsResponse>('/exotics/paths', req, signal),
  americanMC: (req: AmericanMCRequest, signal?: AbortSignal) =>
    post<AmericanMCResponse>('/exotics/american', req, signal),
  multiAsset: (req: MultiAssetRequest, signal?: AbortSignal) =>
    post<MultiAssetResponse>('/multi-asset/price', req, signal),
  quanto: (req: QuantoRequest, signal?: AbortSignal) =>
    post<QuantoResponse>('/multi-asset/quanto', req, signal),
  rateCurve: (req: CurveRequest, signal?: AbortSignal) =>
    post<CurveResponse>('/rates/curve', req, signal),
  rateSwap: (req: SwapRequest, signal?: AbortSignal) =>
    post<SwapResponse>('/rates/swap', req, signal),
  rateBond: (req: BondRequest, signal?: AbortSignal) =>
    post<BondResponse>('/rates/bond', req, signal),
  rateOptions: (req: RateOptionRequest, signal?: AbortSignal) =>
    post<RateOptionResponse>('/rates/options', req, signal),
  shortRate: (req: ShortRateRequest, signal?: AbortSignal) =>
    post<ShortRateResponse>('/rates/short-rate', req, signal),
  calibrateHullWhite: (req: HWCalibrationRequest, signal?: AbortSignal) =>
    post<HWCalibrationResponse>('/rates/calibrate-hull-white', req, signal),
  autocallable: (req: AutocallableRequest, signal?: AbortSignal) =>
    post<AutocallableResponse>('/structured/autocallable', req, signal),
  reverseConvertible: (req: ReverseConvertibleRequest, signal?: AbortSignal) =>
    post<ReverseConvertibleResponse>('/structured/reverse-convertible', req, signal),
  varianceSwap: (req: VarianceRequest, signal?: AbortSignal) =>
    post<VarianceResponse>('/structured/variance', req, signal),
  cliquet: (req: CliquetRequest, signal?: AbortSignal) =>
    post<CliquetResponse>('/structured/cliquet', req, signal),
  portfolioRisk: (req: RiskRequest, signal?: AbortSignal) =>
    post<RiskResponse>('/structured/risk', req, signal),
  cds: (req: CDSRequest, signal?: AbortSignal) => post<CDSResponse>('/credit/cds', req, signal),
  xva: (req: XVARequest, signal?: AbortSignal) => post<XVAResponse>('/credit/xva', req, signal),
}
