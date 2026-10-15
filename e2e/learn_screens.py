"""Capture a screenshot of every page and the position of each region, for the Learn guides.

The page guides draw numbered markers over these screenshots; markers refer to regions by
key: "panel" (the inputs on the left), "hero" (the headline result card) or a card's heading.
Re-run after UI changes (`make learn-shots`, with `make dev` running).

Usage: python e2e/learn_screens.py [base_url]
"""

import json
import sys
from pathlib import Path

from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parents[1]
IMAGES = ROOT / "frontend" / "public" / "learn"
MANIFEST = ROOT / "frontend" / "src" / "features" / "learn" / "screens.json"

PAGES = {
    "vanilla-pricer": "/vanilla",
    "vanilla-implied-vol": "/vanilla/implied-vol",
    "vanilla-methods": "/vanilla/methods",
    "vanilla-strategies": "/vanilla/strategies",
    "vanilla-hedging": "/vanilla/hedging",
    "volatility-surface": "/volatility",
    "volatility-models": "/volatility/models",
    "volatility-calibration": "/volatility/calibration",
    "exotics-pricer": "/exotics",
    "exotics-american": "/exotics/american",
    "multi-asset-correlation": "/multi-asset",
    "multi-asset-quanto": "/multi-asset/quanto",
    "rates-curves": "/rates",
    "rates-linear": "/rates/linear",
    "rates-options": "/rates/options",
    "rates-models": "/rates/models",
    "structured-autocallable": "/structured",
    "structured-reverse-convertible": "/structured/reverse-convertible",
    "structured-cliquet": "/structured/cliquet",
    "structured-variance": "/structured/variance",
    "structured-risk": "/structured/risk",
    "credit-cds": "/credit",
    "credit-xva": "/credit/xva",
}

REGIONS_JS = """
() => {
  const box = (el) => {
    const r = el.getBoundingClientRect()
    return [r.left + scrollX, r.top + scrollY, r.width, r.height].map(Math.round)
  }
  const regions = []
  const panel = document.querySelector('main aside')
  if (panel) regions.push({ key: 'panel', box: box(panel) })
  const hero = document.querySelector('p.text-5xl')?.closest('[data-slot=card]')
  if (hero) regions.push({ key: 'hero', box: box(hero) })
  for (const card of document.querySelectorAll('main [data-slot=card]')) {
    if (card === hero || card.closest('aside')) continue
    const h = card.querySelector('h2')
    if (h) regions.push({ key: h.textContent.trim(), box: box(card) })
  }
  const root = document.documentElement
  return { width: root.scrollWidth, height: root.scrollHeight, regions }
}
"""


def main() -> int:
    base = sys.argv[1] if len(sys.argv) > 1 else "http://localhost:5173"
    IMAGES.mkdir(parents=True, exist_ok=True)
    manifest = {}
    with sync_playwright() as p:
        browser = p.chromium.launch(channel="chrome")
        page = browser.new_page(viewport={"width": 1280, "height": 900}, color_scheme="light")
        for key, path in PAGES.items():
            page.goto(base + path)
            page.wait_for_load_state("networkidle")
            page.wait_for_timeout(2500)  # charts animate in; slow Monte Carlo pages settle
            page.screenshot(path=IMAGES / f"{key}.jpg", full_page=True, type="jpeg", quality=72)
            manifest[key] = {"path": path, **page.evaluate(REGIONS_JS)}
            print(f"✓ {key}: {len(manifest[key]['regions'])} regions")
        browser.close()
    MANIFEST.write_text(json.dumps(manifest, indent=1, ensure_ascii=False) + "\n")
    return 0


if __name__ == "__main__":
    sys.exit(main())
