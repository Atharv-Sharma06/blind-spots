# scaffold-backend decisions

- Build backend is hatchling (src layout); `requires-python = ">=3.12,<3.13"`; deps unpinned in pyproject, pinned by uv.lock.
- mypy: `disallow_untyped_defs` applied to `blindspots.*` only; third-party stubs ignored for scipy, sklearn, openpyxl, docx. Pydantic mypy plugin enabled.
- CLI exits 2 with `not implemented yet: blindspots.pipeline.<name>` only when that exact module is missing (a missing dependency inside an existing module still raises).
- Health: `status` is "ok" only when both VERSION and LATEST files exist; otherwise "degraded" with null versions.
- Error envelope handles ApiError (helper for routes), Starlette/FastAPI HTTPException (404->not_found, 422/400->validation_error, 503->artifact_missing, other 5xx->internal), RequestValidationError, and any other exception (500 internal, no internals leaked).
- Extra Literal aliases beyond section 3 exist in schemas.py (FlowQualifier, AirflowBasis, ProfileStatus, InvestigationRole); ExperimentRecord/Observation keep material_family etc. as `str | None` per contract.
