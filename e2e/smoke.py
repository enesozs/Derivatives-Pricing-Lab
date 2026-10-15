"""Browser smoke test: click through every page and fail on any console error or bad response.

Needs the dev servers running (`make dev`) and Google Chrome installed. Run with `make e2e`.
Usage: python e2e/smoke.py [base_url] [screenshot_dir]
"""

import re
import sys
from pathlib import Path

from playwright.sync_api import ConsoleMessage, Page, Response, expect, sync_playwright

BASE = sys.argv[1] if len(sys.argv) > 1 else "http://localhost:5173"
SHOTS = Path(sys.argv[2]) if len(sys.argv) > 2 else None


def shot(page: Page, name: str) -> None:
    if SHOTS:
        SHOTS.mkdir(parents=True, exist_ok=True)
        page.screenshot(path=SHOTS / f"{name}.png", full_page=True)


def main() -> int:
    problems: list[str] = []
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True, channel="chrome")
        page = browser.new_page(viewport={"width": 1440, "height": 1000})

        def on_console(message: ConsoleMessage) -> None:
            if message.type == "error":
                problems.append(f"console: {message.text}")

        def on_response(response: Response) -> None:
            if response.status >= 400:
                problems.append(f"HTTP {response.status} {response.url}")

        page.on("console", on_console)
        page.on("pageerror", lambda e: problems.append(f"page error: {e}"))
        page.on("response", on_response)
        hero = page.locator("p.text-5xl").first

        # Pricer: European call matches the textbook value;
        # an American put marks two methods unsupported.
        page.goto(BASE)
        expect(page).to_have_url(f"{BASE}/vanilla")
        expect(hero).to_have_text("10.4506")
        page.get_by_role("radio", name="Put").first.click()
        page.get_by_role("radio", name="American").first.click()
        expect(page.get_by_text("Not supported")).to_have_count(2)
        expect(page.get_by_text("Crank–Nicolson PDE · 400×200")).to_be_visible()
        shot(page, "pricer")

        # Implied volatility: round-trips the Black–Scholes price; flags arbitrage violations.
        page.get_by_role("link", name="Implied volatility").click()
        price = page.get_by_role("textbox", name="Option price")
        price.fill("150")
        price.press("Enter")
        expect(page.get_by_text("No implied volatility for this price")).to_be_visible()
        price.fill("10.45")
        price.press("Enter")
        expect(hero).to_have_text("20.00%")
        shot(page, "implied-vol")

        # Trees & grids: tree visualiser and PDE boundary for an American put (the page default).
        page.get_by_role("link", name="Trees & grids").click()
        expect(page.get_by_role("heading", name="Binomial tree, node by node")).to_be_visible()
        page.get_by_role("radio", name="Leisen–Reimer").click()
        page.get_by_role("radio", name="8", exact=True).click()
        expect(page.get_by_text("Early-exercise boundary")).to_be_visible()
        expect(page.get_by_text("Switch to American exercise")).to_have_count(0)
        shot(page, "methods")

        # Hedging: the simulated error should sit close to the Derman–Kamal approximation.
        page.get_by_role("link", name="Hedging").click()
        expect(page.get_by_text("Theory (Derman–Kamal)")).to_be_visible()
        error = float(hero.inner_text())
        assert 0.8 < error < 1.05, f"hedging error {error} far from theory (~0.92)"
        shot(page, "hedging")

        # Strategies: presets, editing, empty state.
        page.get_by_role("link", name="Strategies").click()
        expect(hero).to_have_text("16.02")  # long straddle debit
        expect(page.get_by_text("Stress test: P&L by spot and volatility")).to_be_visible()
        page.get_by_role("button", name="Iron condor").click()
        expect(page.get_by_text("Net credit")).to_be_visible()
        expect(page.locator("fieldset")).to_have_count(4)
        page.get_by_role("button", name="Add leg").click()
        expect(page.locator("fieldset")).to_have_count(5)
        for i in range(5, 0, -1):
            page.get_by_role("button", name=f"Remove leg {i}").click()
        expect(page.get_by_text("Add a leg to get started")).to_be_visible()
        page.get_by_role("button", name="Calendar spread").click()
        expect(page.get_by_text("0.25 yrs")).to_be_visible()  # horizon = front-month expiry
        expect(page.get_by_text("Stress test: P&L by spot and volatility")).to_be_visible()
        shot(page, "strategies")

        # Volatility: surface from the bundled snapshot, then synthetic data.
        page.get_by_role("link", name="Volatility", exact=True).click()
        expect(page.get_by_role("heading", name="Implied volatility surface")).to_be_visible()
        expect(page.get_by_text("From raw quotes to a smile")).to_be_visible()
        expect(page.get_by_role("cell", name="Jan 19, 2029")).to_be_visible(timeout=15_000)
        page.get_by_role("radio", name="Synthetic").click()
        expect(page.get_by_text("Synthetic data")).to_be_visible(timeout=15_000)
        shot(page, "volatility-surface")

        # Models playground: switching models re-prices the smile.
        page.get_by_role("link", name="Models").click()
        page.get_by_role("radio", name="Merton").click()
        expect(page.get_by_text("Jumps per year λ")).to_be_visible()
        shot(page, "volatility-models")

        # Calibration: Heston on synthetic data must fit almost perfectly.
        page.get_by_role("link", name="Calibration").click()
        expect(page.get_by_text("Feller condition")).to_be_visible(timeout=15_000)
        rmse = float(hero.inner_text())
        assert rmse < 0.3, f"Heston fit to its own synthetic data should be tight, got {rmse}"
        shot(page, "volatility-calibration")

        # Exotics: the default down-and-out call matches its closed form; every product prices.
        page.get_by_role("link", name="Exotics", exact=True).click()
        expect(page.get_by_role("heading", name="Exotic options")).to_be_visible()
        expect(hero).to_have_text("9.9234")
        for product in ("Digital", "Asian", "Lookback", "Barrier"):
            page.get_by_role("radio", name=product, exact=True).click()
            expect(page.get_by_role("heading", name="Which methods can price it")).to_be_visible()
            expect(page.get_by_text("Priced").first).to_be_visible(timeout=15_000)
        page.get_by_role("radio", name="Heston").first.click()
        expect(page.get_by_text("Monte Carlo · 50,000 paths").first).to_be_visible(timeout=15_000)
        shot(page, "exotics")

        # American by simulation: Longstaff–Schwartz lands near the tree.
        page.get_by_role("link", name="American by simulation").click()
        expect(page.get_by_text("Early-exercise premium")).to_be_visible(timeout=20_000)
        expect(hero).not_to_have_text("—", timeout=20_000)
        lsm = float(hero.inner_text())
        assert abs(lsm - 6.09) < 0.08, f"LSM American put {lsm} far from tree value 6.09"
        shot(page, "exotics-american")

        # Multi-asset: every product prices; more assets fall back to Monte Carlo.
        page.get_by_role("link", name="Multi-asset", exact=True).click()
        expect(page.get_by_role("heading", name="Correlation lab")).to_be_visible()
        for product in ("Exchange", "Spread", "Best-of", "Worst-of", "Basket"):
            page.get_by_role("radio", name=product, exact=True).click()
            expect(page.get_by_text("Correlation sensitivity")).to_be_visible(timeout=15_000)
        page.get_by_role("radio", name="4 assets").click()
        expect(page.get_by_text("Asset 4")).to_be_visible()
        shot(page, "multi-asset")
        page.get_by_role("link", name="Quanto").click()
        expect(page.get_by_text("Drift adjustment")).to_be_visible(timeout=15_000)
        expect(hero).to_have_text("9.3583")  # matches QuantLib's quanto engine
        shot(page, "quanto")

        # Rates: the bootstrap reprices its quotes; every page prices off the shared curve.
        page.get_by_role("link", name="Rates", exact=True).click()
        expect(page.get_by_role("heading", name="Yield curves")).to_be_visible()
        expect(page.get_by_role("cell", name="Swap 10Y")).to_be_visible(timeout=15_000)
        shot(page, "rates-curves")
        page.get_by_role("link", name="Swaps & bonds").click()
        expect(hero).to_have_text("0", timeout=15_000)  # a swap at the par rate is worth zero
        page.get_by_role("radio", name="Off-market").click()
        expect(hero).not_to_have_text("0", timeout=15_000)
        expect(page.get_by_text("Modified duration")).to_be_visible()
        shot(page, "rates-linear")
        page.get_by_role("link", name="Caps & swaptions").click()
        for product in ("Cap", "Floor", "Payer", "Receiver"):
            page.get_by_role("radio", name=product, exact=True).click()
            expect(hero).not_to_have_text("—", timeout=15_000)
        page.get_by_role("radio", name="Bachelier (normal)").click()
        expect(page.get_by_text("Equivalent Black vol")).to_be_visible(timeout=15_000)
        shot(page, "rates-options")
        page.get_by_role("link", name="Short-rate models").click()
        expect(page.get_by_text("Bermudan, tree")).to_be_visible(timeout=15_000)
        page.get_by_role("button", name="Use fitted a, σ").click()
        shot(page, "rates-models")
        # Editing the curve reaches the other pages.
        page.get_by_role("link", name="Curves").click()
        page.get_by_role("button", name="+25bp").click()
        page.get_by_role("link", name="Swaps & bonds").click()
        expect(page.get_by_text("Priced on the edited curve")).to_be_visible()

        # Structured products: each page prices; the fair coupon reprices the note at par.
        page.get_by_role("link", name="Structured", exact=True).click()
        expect(page.get_by_role("heading", name="Autocallable notes")).to_be_visible()
        expect(hero).not_to_have_text("—", timeout=20_000)
        page.get_by_role("button", name="Set the fair coupon").click()
        page.get_by_role("radio", name="Worst of 3").click()
        expect(page.get_by_text("Fair coupon against correlation")).to_be_visible(timeout=20_000)
        shot(page, "structured-autocallable")
        page.get_by_role("link", name="Reverse convertibles").click()
        expect(page.get_by_text("What the note is made of")).to_be_visible()
        page.get_by_role("button", name="Set the fair coupon").click()
        expect(hero).to_have_text(re.compile(r"^(99\.9\d|100\.0\d)%$"), timeout=15_000)
        shot(page, "structured-reverse-convertible")
        page.get_by_role("link", name="Cliquets").click()
        expect(page.get_by_text("Heston value")).to_be_visible()
        expect(hero).not_to_have_text("—", timeout=20_000)
        shot(page, "structured-cliquet")
        page.get_by_role("link", name="Variance swaps").click()
        expect(page.get_by_text("Volatility swap strike", exact=True)).to_be_visible()
        page.get_by_role("radio", name="Jumps").click()
        expect(page.get_by_text("Jumps: the strip misprices variance")).to_be_visible(
            timeout=15_000
        )
        shot(page, "structured-variance")
        page.get_by_role("link", name="Portfolio risk").click()
        expect(page.get_by_role("cell", name="Book", exact=True)).to_be_visible(timeout=20_000)
        page.get_by_role("button", name="Market maker").click()
        expect(page.get_by_role("cell", name="Digital put (pays 1)")).to_be_visible(timeout=20_000)
        shot(page, "structured-risk")

        # Routing: deep links and unknown paths.
        page.goto(f"{BASE}/vanilla/strategies")
        expect(page.get_by_role("heading", name="Option strategies")).to_be_visible()
        page.goto(f"{BASE}/no-such-page")
        expect(page.get_by_text("Page not found")).to_be_visible()
        browser.close()

    for problem in dict.fromkeys(problems):
        print("✗", problem)
    print("✓ smoke test passed" if not problems else f"✗ {len(problems)} problem(s)")
    return 1 if problems else 0


if __name__ == "__main__":
    sys.exit(main())
