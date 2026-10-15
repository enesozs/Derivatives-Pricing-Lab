"""Print the OpenAPI schema; the frontend generates its TypeScript types from it."""

import json

from .main import app

if __name__ == "__main__":
    print(json.dumps(app.openapi(), indent=2))
