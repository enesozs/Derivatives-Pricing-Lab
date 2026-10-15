/** Plain-language definitions of every term the lab uses, with where to see it. */

export interface Term {
  term: string
  definition: string
  /** A page where the term appears. */
  see?: { to: string; label: string }
}

export const GLOSSARY: Term[] = [
  {
    term: 'American option',
    definition:
      'An option that can be exercised at any time up to expiry, not only at the end. Worth at least as much as the European version.',
    see: { to: '/vanilla/methods', label: 'Trees & grids' },
  },
  {
    term: 'Annuity',
    definition:
      'Today’s value of receiving 1 on every payment date of a swap or bond. Multiplying it by a rate turns that rate into a present value.',
    see: { to: '/rates/linear', label: 'Swaps & bonds' },
  },
  {
    term: 'Arbitrage',
    definition:
      'A trade that makes money with no risk and no investment. Prices that allow one are inconsistent; models and cleaning checks rule them out.',
    see: { to: '/volatility', label: 'Volatility surface' },
  },
  {
    term: 'At the money (ATM)',
    definition:
      'An option whose strike equals the current price (or the forward). In the money: exercising now would pay; out of the money: it would not.',
  },
  {
    term: 'Autocallable',
    definition:
      'A note that pays a high coupon and is repaid early if the stock is above a level on an observation date; the investor risks losses if it falls below a protection barrier.',
    see: { to: '/structured', label: 'Autocallables' },
  },
  {
    term: 'Bachelier model',
    definition:
      'An option model where the price (or rate) moves by fixed amounts rather than percentages. Allows negative rates; volatility is quoted in basis points.',
    see: { to: '/rates/options', label: 'Caps & swaptions' },
  },
  {
    term: 'Barrier option',
    definition:
      'An option that is switched off (knock-out) or on (knock-in) if the price ever touches a barrier level. Cheaper than the vanilla.',
    see: { to: '/exotics', label: 'Exotic pricer' },
  },
  {
    term: 'Basis point (bp)',
    definition:
      'One hundredth of a percent: 0.01%. 25bp = 0.25%. Used for rates, spreads and small changes.',
  },
  {
    term: 'Bermudan option',
    definition:
      'An option exercisable on a set of dates: between European (one date) and American (any date).',
    see: { to: '/rates/models', label: 'Short-rate models' },
  },
  {
    term: 'Black–Scholes',
    definition:
      'The classic option model: the stock’s log-returns are normal with constant volatility. Gives closed-form prices and Greeks; the benchmark everything else is compared with.',
    see: { to: '/vanilla', label: 'Pricer' },
  },
  {
    term: 'Black-76',
    definition:
      'Black–Scholes applied to a forward or futures price; the standard model for caps and swaptions, with volatility quoted in % of the rate.',
    see: { to: '/rates/options', label: 'Caps & swaptions' },
  },
  {
    term: 'Bootstrapping',
    definition:
      'Building a curve one point at a time from market quotes, shortest maturity first, so that every quote is matched exactly.',
    see: { to: '/rates', label: 'Yield curves' },
  },
  {
    term: 'Calibration',
    definition:
      'Choosing a model’s parameters so its prices match market prices as closely as possible.',
    see: { to: '/volatility/calibration', label: 'Calibration' },
  },
  {
    term: 'Call option',
    definition: 'The right to buy at the strike price. Pays max(price − strike, 0) at expiry.',
  },
  {
    term: 'Cap / floor',
    definition:
      'A strip of options on a floating interest rate, one per period: a cap pays when the rate is above the strike (insurance for a borrower), a floor when it is below.',
    see: { to: '/rates/options', label: 'Caps & swaptions' },
  },
  {
    term: 'CDS (credit default swap)',
    definition:
      'Insurance against a company’s default: the buyer pays a yearly spread; if the company defaults, the seller pays the loss.',
    see: { to: '/credit', label: 'CDS & default curves' },
  },
  {
    term: 'Cliquet',
    definition:
      'A product paying the sum of periodic returns, each capped and floored, often with a guaranteed minimum total.',
    see: { to: '/structured/cliquet', label: 'Cliquets' },
  },
  {
    term: 'Closed form',
    definition:
      'A formula that gives the price directly, as opposed to a numerical method (tree, grid, simulation). Fast and exact, but only exists for some products and models.',
  },
  {
    term: 'Collateral',
    definition:
      'Cash or securities posted to cover what one party owes on a trade, so a default costs less.',
    see: { to: '/credit/xva', label: 'Counterparty risk' },
  },
  {
    term: 'Convexity',
    definition:
      'Curvature of value against an input. For bonds, the price gains more when yields fall than it loses when they rise; for options, gamma.',
    see: { to: '/rates/linear', label: 'Swaps & bonds' },
  },
  {
    term: 'Correlation',
    definition:
      'How much two prices move together, from −1 (opposite) through 0 (independent) to +1 (in lockstep).',
    see: { to: '/multi-asset', label: 'Correlation lab' },
  },
  {
    term: 'Credit triangle',
    definition:
      'Rule of thumb: CDS spread ≈ default rate × (1 − recovery). 120bp at 40% recovery ≈ 2% default probability a year.',
    see: { to: '/credit', label: 'CDS & default curves' },
  },
  {
    term: 'CS01',
    definition: 'Value change of a credit position when every CDS spread widens by 1bp.',
    see: { to: '/credit', label: 'CDS & default curves' },
  },
  {
    term: 'CVA',
    definition:
      'Credit valuation adjustment: the price of the risk that a counterparty defaults while owing you money on a trade.',
    see: { to: '/credit/xva', label: 'Counterparty risk' },
  },
  {
    term: 'Delta (Δ)',
    definition:
      'Change in option value for a 1 move in the underlying; also the number of shares needed to hedge. Between 0 and 1 for a call.',
    see: { to: '/vanilla', label: 'Pricer' },
  },
  {
    term: 'Delta hedging',
    definition:
      'Trading the underlying to offset an option’s delta, so small price moves don’t change the position’s value.',
    see: { to: '/vanilla/hedging', label: 'Hedging' },
  },
  {
    term: 'Discount factor',
    definition: 'Today’s value of 1 paid at a future date. Below 1 when rates are positive.',
    see: { to: '/rates', label: 'Yield curves' },
  },
  {
    term: 'Dividend yield',
    definition:
      'Dividends paid by the stock as an annual percentage of its price. Dividends lower call values and raise put values.',
  },
  {
    term: 'Duration',
    definition:
      'A bond’s sensitivity to its yield: modified duration 8 means a 1% rise in yield lowers the price by about 8%.',
    see: { to: '/rates/linear', label: 'Swaps & bonds' },
  },
  {
    term: 'DV01',
    definition: 'Value change for a 1 basis point move in interest rates.',
    see: { to: '/rates/linear', label: 'Swaps & bonds' },
  },
  {
    term: 'DVA',
    definition:
      'Debit valuation adjustment: the mirror of CVA, the value to you of your own possible default on what you owe.',
    see: { to: '/credit/xva', label: 'Counterparty risk' },
  },
  {
    term: 'Early-exercise premium',
    definition: 'American value minus European value: what the right to exercise early is worth.',
    see: { to: '/exotics/american', label: 'American by simulation' },
  },
  { term: 'European option', definition: 'An option that can only be exercised at expiry.' },
  {
    term: 'Exposure (EE, PFE)',
    definition:
      'What a counterparty could owe you in the future. Expected exposure is the average; potential future exposure (PFE) a bad case, e.g. the 95th percentile.',
    see: { to: '/credit/xva', label: 'Counterparty risk' },
  },
  {
    term: 'Fair coupon',
    definition:
      'The coupon that makes a note worth exactly 100% of what the investor pays. Issuers pay less than this; the difference is their margin.',
    see: { to: '/structured', label: 'Autocallables' },
  },
  {
    term: 'Forward price',
    definition:
      'The price agreed today for delivery at a future date: spot grown at the interest rate minus the dividend yield.',
  },
  {
    term: 'Forward rate',
    definition: 'The interest rate locked in today for a future period, implied by the curve.',
    see: { to: '/rates', label: 'Yield curves' },
  },
  {
    term: 'Gamma (Γ)',
    definition:
      'How fast delta changes as the price moves. High gamma means the hedge must be adjusted often; largest at the money near expiry.',
    see: { to: '/vanilla', label: 'Pricer' },
  },
  {
    term: 'Greeks',
    definition:
      'Sensitivities of a price to its inputs: delta (spot), gamma (spot, second order), vega (volatility), theta (time), rho (rates).',
    see: { to: '/vanilla', label: 'Pricer' },
  },
  {
    term: 'Hazard rate',
    definition:
      'The rate at which defaults happen, given no default so far: a 2% hazard rate means about a 2% chance of default in the next year.',
    see: { to: '/credit', label: 'CDS & default curves' },
  },
  {
    term: 'Heston model',
    definition:
      'A model where volatility itself is random and mean-reverting, usually moving opposite to the price. Produces volatility smiles and skews.',
    see: { to: '/volatility/models', label: 'Volatility models' },
  },
  {
    term: 'Hull–White model',
    definition:
      'An interest-rate model with one random short rate, built to match today’s yield curve exactly.',
    see: { to: '/rates/models', label: 'Short-rate models' },
  },
  {
    term: 'Implied volatility',
    definition:
      'The volatility that, put into Black–Scholes, reproduces an option’s market price. The market’s way of quoting options.',
    see: { to: '/vanilla/implied-vol', label: 'Implied volatility' },
  },
  {
    term: 'Intrinsic value',
    definition:
      'What exercising right now would pay (zero if out of the money). Option value = intrinsic value + time value.',
  },
  {
    term: 'Local volatility',
    definition:
      'A volatility that depends on the price level and time, derived from the implied surface (Dupire) so that every vanilla price is matched.',
    see: { to: '/volatility', label: 'Volatility surface' },
  },
  {
    term: 'Mean reversion',
    definition:
      'The pull of a quantity (volatility, interest rates) back towards a long-run level.',
  },
  {
    term: 'Monte Carlo',
    definition:
      'Pricing by simulating many random price paths and averaging the discounted payoffs. Works for any product; its error shrinks like 1/√paths.',
    see: { to: '/vanilla', label: 'Pricer' },
  },
  {
    term: 'Notional',
    definition:
      'The amount a contract’s payments are calculated on (e.g. 10M for a swap). Not usually exchanged itself.',
  },
  {
    term: 'Par rate / par spread',
    definition:
      'The fixed rate (swap) or spread (CDS) that makes the contract worth exactly zero today.',
  },
  {
    term: 'Payoff',
    definition: 'What a contract pays at expiry as a function of the underlying price.',
  },
  {
    term: 'PDE method',
    definition:
      'Pricing by solving the option’s partial differential equation on a grid of prices and times, stepping back from expiry.',
    see: { to: '/vanilla/methods', label: 'Trees & grids' },
  },
  {
    term: 'Put option',
    definition:
      'The right to sell at the strike price. Pays max(strike − price, 0) at expiry; protection against falls.',
  },
  {
    term: 'Quanto',
    definition: 'An option on a foreign asset paid in your currency at a fixed exchange rate.',
    see: { to: '/multi-asset/quanto', label: 'Quanto' },
  },
  {
    term: 'Recovery rate',
    definition:
      'The share of what is owed that creditors get back after a default; typically assumed to be 40%.',
    see: { to: '/credit', label: 'CDS & default curves' },
  },
  {
    term: 'Reverse convertible',
    definition:
      'A high-coupon note that repays in shares if the stock falls below a strike: a bond plus a sold put.',
    see: { to: '/structured/reverse-convertible', label: 'Reverse convertibles' },
  },
  {
    term: 'Rho (ρ)',
    definition: 'Change in value for a move in interest rates (here per 1%).',
    see: { to: '/vanilla', label: 'Pricer' },
  },
  {
    term: 'Risk-neutral probability',
    definition:
      'The probabilities used for pricing, under which every asset grows at the risk-free rate. They include the market’s price of risk, so they are not forecasts of what will happen.',
  },
  {
    term: 'Skew / smile',
    definition:
      'The pattern of implied volatility across strikes: a smile curves up on both sides; a skew slopes, with low strikes more expensive (typical for stocks).',
    see: { to: '/volatility', label: 'Volatility surface' },
  },
  { term: 'Spot', definition: 'The current price of the underlying.' },
  {
    term: 'Spread (CDS)',
    definition: 'The yearly premium paid for credit protection, in basis points of the notional.',
    see: { to: '/credit', label: 'CDS & default curves' },
  },
  {
    term: 'Standard error / 95% interval',
    definition:
      'How uncertain a Monte Carlo estimate is. “± 0.02” means the true value is within 0.02 of the estimate about 95% of the time.',
  },
  {
    term: 'Strike',
    definition: 'The fixed price at which an option lets you buy (call) or sell (put).',
  },
  {
    term: 'Survival probability',
    definition: 'The probability a company has not defaulted by a given date.',
    see: { to: '/credit', label: 'CDS & default curves' },
  },
  {
    term: 'Swap',
    definition:
      'An exchange of fixed interest payments for floating ones on a notional. The payer pays fixed and gains when rates rise.',
    see: { to: '/rates/linear', label: 'Swaps & bonds' },
  },
  {
    term: 'Swaption',
    definition: 'An option to enter a swap later at a fixed rate agreed today.',
    see: { to: '/rates/options', label: 'Caps & swaptions' },
  },
  {
    term: 'Term structure',
    definition: 'How a quantity (rates, volatility) varies with maturity.',
    see: { to: '/volatility', label: 'Volatility surface' },
  },
  {
    term: 'Theta (θ)',
    definition:
      'Value lost as one day passes, everything else unchanged. Usually negative for bought options.',
    see: { to: '/vanilla', label: 'Pricer' },
  },
  {
    term: 'Time value',
    definition:
      'The part of an option’s value above its intrinsic value: the value of what could still happen before expiry.',
    see: { to: '/vanilla', label: 'Pricer' },
  },
  {
    term: 'Tree (binomial)',
    definition:
      'A numerical method where the price moves up or down at each step; the option is valued backwards from expiry.',
    see: { to: '/vanilla/methods', label: 'Trees & grids' },
  },
  {
    term: 'Underlying',
    definition:
      'The asset an option or derivative is written on (a stock, index, rate, exchange rate).',
  },
  {
    term: 'Variance swap',
    definition:
      'A contract paying realised variance minus a fixed strike: a pure bet on how much the price will move, not which way.',
    see: { to: '/structured/variance', label: 'Variance swaps' },
  },
  {
    term: 'Vega (ν)',
    definition: 'Change in value for a 1 point move in volatility.',
    see: { to: '/vanilla', label: 'Pricer' },
  },
  {
    term: 'Volatility',
    definition:
      'How much a price moves, as the annualised standard deviation of returns: 20% means a typical yearly move of about ±20%.',
  },
  {
    term: 'Volatility point',
    definition: 'One percentage point of volatility: from 20% to 21% is +1 vol point.',
  },
  {
    term: 'Worst-of',
    definition:
      'A product that pays according to the worst performer of several assets. Cheaper (or higher coupon), and sensitive to correlation.',
    see: { to: '/structured', label: 'Autocallables' },
  },
  {
    term: 'Yield to maturity',
    definition:
      'The single interest rate that makes a bond’s discounted cash flows equal its price.',
    see: { to: '/rates/linear', label: 'Swaps & bonds' },
  },
  {
    term: 'Zero rate',
    definition:
      'The average interest rate from today to a date, implied by the discount factor: DF = e^(−zero rate × time).',
    see: { to: '/rates', label: 'Yield curves' },
  },
]
