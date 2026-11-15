# Blind Spots analysis service

Python 3.12 uv project (package `blindspots`). Contracts: `docs/CONTRACTS.md` at the repo root.

```
uv sync
uv run pytest -q
uv run ruff check . && uv run ruff format --check .
uv run mypy src
uv run blindspots --help      # build-dataset, raw-manifest, fetch-raw, train, export-artifacts, serve
uv run blindspots serve       # http://127.0.0.1:8000/api/health
```

Set `BLINDSPOTS_ROOT` to override repo-root discovery. Commands whose pipeline module is not
yet written exit with status 2 and print `not implemented yet: <module>`.
