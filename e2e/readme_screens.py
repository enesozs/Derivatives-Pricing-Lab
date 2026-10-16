"""Screenshots for the README (docs/screenshots). Re-run after visible UI changes, with
`make dev` running: python e2e/readme_screens.py [base_url]

Each shot is either the top of a page (what a visitor first sees) or one card, found by its
heading.
"""

import sys
from pathlib import Path

from playwright.sync_api import sync_playwright

OUT = Path(__file__).resolve().parents[1] / "docs" / "screenshots"

# name -> (path, card heading or None for the top of the page)
SHOTS: dict[str, tuple[str, str | None]] = {
    "vanilla-pricer": ("/vanilla", None),
    "vanilla-strategies": (
        "/vanilla/strategies",
        "Stress test: P&L by spot and volatility",
    ),
    "volatility-surface": ("/volatility", None),
    "volatility-calibration": (
        "/volatility/calibration",
        "Market vs model, expiry by expiry",
    ),
    "exotics-pricer": ("/exotics", None),
    "multi-asset-correlation": ("/multi-asset", None),
    "rates-models": ("/rates/models", None),
    "structured-autocallable": ("/structured", None),
    "structured-risk": (
        "/structured/risk",
        "Stress grid: book P&L by spot and volatility",
    ),
    "credit-xva": ("/credit/xva", None),
    "learn-tour": ("/learn/05-rates#rates-linear", None),
}


def main() -> int:
    base = sys.argv[1] if len(sys.argv) > 1 else "http://localhost:5173"
    OUT.mkdir(parents=True, exist_ok=True)
    with sync_playwright() as p:
        browser = p.chromium.launch(channel="chrome")
        page = browser.new_page(
            viewport={"width": 1440, "height": 960}, color_scheme="light"
        )
        for name, (path, heading) in SHOTS.items():
            page.goto(base + path)
            page.wait_for_load_state("networkidle")
            page.wait_for_timeout(2500)
            target = OUT / f"{name}.jpg"
            if heading is None:
                page.screenshot(path=target, type="jpeg", quality=80)
            else:
                card = page.locator("[data-slot=card]").filter(
                    has=page.get_by_role("heading", name=heading, exact=True)
                )
                card.first.scroll_into_view_if_needed()
                page.wait_for_timeout(600)
                card.first.screenshot(path=target, type="jpeg", quality=82)
            print(f"✓ {name}")
        browser.close()
    return 0


if __name__ == "__main__":
    sys.exit(main())
