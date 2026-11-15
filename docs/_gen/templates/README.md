# Blind Spots

**Do NASA's space-station fire tests cover the air in a Moon or Mars cabin?**

Blind Spots shows, for any crew cabin, whether NASA's ISS flame tests ran in air like it, and which next experiment
would teach the most. Built for NASA Space Apps Challenge 2026, "Flame in Freefall". Not endorsed by NASA.

**[Live app]({{DEPLOYED_URL}})** · **[30-second video]({{VIDEO_URL}})** · [Source code]({{GITHUB_URL}})

> SI-assisted project: built with Claude (Anthropic). See [Use of SI](#use-of-si-super-intelligence).

![Cabins page: one card per crew cabin, showing its air and whether the ISS flame tests cover it](docs/img/cabins-pick.png)

## How to use it

Open the [live site]({{DEPLOYED_URL}}). The home page asks the question and shows the key numbers. Press **Check a cabin**
to open the Cabins tool (`/cabins`).

1. **Pick a cabin.** Each card shows the cabin's air and one label: Covered, Barely covered or Not covered.
2. **Read the answer.** One line says whether ISS tests cover that air. A chart shows where the tests ran and where the cabin sits.
3. **See what to test next.** The three most useful computational research candidates, and what each could teach us.

New here? Watch the **30-second tour** (button on the home page and the Cabins page, or open `/cabins?demo=1`).

![The answer for NASA's Exploration Atmosphere: every ISS test sits near 1 atm, far from the cabin](docs/img/cabins-answer.png)

More pages: **Cabins** (`/cabins`), **Explorer** (`/explore`, for experts), **Experiments** (`/experiments`, every test with its NASA source cell),
**How it works** (`/methodology`) and **Research brief** (`/brief`, printable).

## What we found

- All {{ENV_N_EXP}} ISS tests in our data ran in ISS-like air, about 1 atm. The Moon and Mars plans use thinner air with more oxygen.
- The ISS cabin has {{H_ISS_COMPARABLE}} nearby ISS test results. NASA's Exploration Atmosphere (8.2 psia, 34 % oxygen) has {{H_EXPL_COMPARABLE}}.
- {{H_N_ZERO}} of {{H_N_PROFILES_ANALYSED}} cabin atmospheres have no nearby ISS test results, including all {{H_N_REDUCED}} below 1 atm ({{H_REDUCED_SHORT}}).
- Where there is no evidence, the app says "Insufficient experimental evidence for a reliable estimate." and shows no probability.
- Default view (NASA Exploration Atmosphere, {{DG_LABEL}}): {{DX_PTS_WITH}} of {{DX_NPTS}} sampled conditions have a nearby test result. The top research candidate is {{TC_O2}} % O2, {{TC_P}} kPa, {{TC_U}} cm/s, with an expected uncertainty reduction of {{TC_EVR}}.
- BASS measured pressure; BASS-II did not, so the data assume the ISS cabin's 101.353 kPa for those tests.

<details>
<summary>Table: every NASA cabin atmosphere we checked</summary>

Computed by `docs/_gen/build.py` from `POST /api/target/assess` for every material setup (the same responses the static
snapshot serves). Dataset `{{DV}}`, model `{{MV}}`.

{{H_PROFILE_TABLE}}

</details>

## What it does not claim

- It is a research-planning tool, not a certified fire-safety assessment, and it has no test or apparatus procedures.
  Candidates are "computational research candidates requiring qualified scientific review, established safety
  procedures and formal feasibility assessment".
- **Air, not gravity.** All ISS tests ran in free fall. NASA's PSI holds no partial-gravity combustion data, so "covered" is about the air only.
- A gap means "not represented in the integrated records", never "NASA has not studied this".
- The model beats a majority-class guess in {{N_GP_BETTER}} of {{N_MODELLED}} material setups. Away from 1 atm its predictions rest on an assumption, so the app shows no probability there.
- No NASA approval or endorsement is claimed.

## Use of SI (super intelligence)

- **Inside the app: machine learning, no language model.** A Gaussian-process model gives the probability that a flame keeps
  burning only where nearby ISS test results support it, and says "Insufficient experimental evidence for a reliable
  estimate." otherwise. Active learning ranks the next experiment by how much it would cut the model's uncertainty about the
  chosen cabin. Every sentence the app shows is a deterministic template filled with computed numbers.
- **To build it: Claude (Anthropic)** wrote and reviewed code, double-transcribed and checked the curation tables, extracted
  the NASA quotes and drafted the documentation. SI output was checked by code, tests and provenance checks
  rather than trusted.
- **No SI-generated images, video or audio.** The demo video and screenshots are headless recordings of the real app.

What Claude (Anthropic) was used for:

- code (Python analysis service, FastAPI API, Next.js app, tests);
- the curation tables that turn free-text BASS/BASS-II matrix cells into values: two independent SI transcriptions per
  chunk, adjudicated, with every quoted token machine-checked as an exact substring of the cited NASA cell
  ({{N_PROVENANCE_FAIL}} provenance failures in this build); see [data/curation/README.md](data/curation/README.md);
- transcription of tables from NASA reports (BASS-II Summary Report Appendix A, DARTFire, the Glenn drop-tower limits,
  Saffire-IV/V/VI, ground flammability thresholds), each row carrying its page and table reference;
- extraction of the verbatim NASA quotes behind the {{N_PROFILES}} atmosphere profiles, machine-checked against the
  downloaded documents;
- research summaries, code and science reviews, this documentation, and the scripted headless capture of the demo video
  and screenshots.

**What the people did:** the project owner directed the work, made the design and scientific decisions (logged with
their rationale in [docs/decisions.md](docs/decisions.md) and `docs/decisions.d/`), reviewed the outputs and decided what
went into the final project. Claude (Anthropic) wrote and transcribed under that direction; its output was checked by
code (`scripts/check_curation_provenance.py`, the pytest and Playwright test suites) and not trusted on its own.

**No NASA branding:** no NASA logos, flags, insignia or mission patches are used in the app, the demo video or the
screenshots. NASA datasets and experiments are named only as citations of where the data comes from. No NASA approval or
endorsement is claimed.

## Data

All model data come from public NASA records; nothing is synthetic outside unit tests.

- **BASS (PSI-26) and BASS-II (PSI-25):** ISS Microgravity Science Glovebox flammability tests (CC0-1.0, NASA PSI). Free-text
  results are interpreted in curation tables with cell-level provenance.
- **Counts:** the dataset lists {{N_EXP}} experiments; {{ENV_N_EXP}} are ISS glovebox tests. Each airflow step of a test is one
  "test result" ({{ENV_N_OBS}} in all). The model learns from {{N_TRAIN_OBS}} test results from {{N_TRAIN_EXP}} experiments;
  {{EXCL_OBS_TOTAL}} are left out (most often because the curated reading had low confidence: {{EXCL_OBS_LOWCONF}}).
- **Context only, never modelled:** Saffire, DARTFire, drop-tower and ground tests, and {{N_NOT_INTEGRATED}} further documented
  investigations that are not integrated.
- **Cabin atmospheres:** {{N_PROFILES}} profiles with verbatim NASA quotes in `data/manifests/atmosphere_profiles.json`.

Full list, licences and caveats: [docs/data-sources.md](docs/data-sources.md). Method and validation:
[docs/scientific-methodology.md](docs/scientific-methodology.md), [docs/validation.md](docs/validation.md).

## Run it yourself

Requirements: Python 3.12 with [uv](https://docs.astral.sh/uv/), Node.js with npm.

```bash
cd services/analysis && uv sync          # backend
cd ../../apps/web && npm ci              # web

# live mode: API, then web
cd ../../services/analysis && uv run blindspots serve    # http://127.0.0.1:8000
cd ../../apps/web && npm run dev                         # http://localhost:3000

# static-snapshot mode (what the public site serves)
cd ../../services/analysis && uv run blindspots export-artifacts --snapshot ../../apps/web/public/snapshot
cd ../../apps/web && NEXT_PUBLIC_DATA_MODE=snapshot npm run build && npm run start
```

`NEXT_PUBLIC_DATA_MODE` is `live`, `snapshot` or `auto` (default: live first, snapshot if the API is down). The repository
contains the generated dataset and model (`data/normalized`, `{{MDIR}}`, `models/retrospective`). Rebuild with
`uv run blindspots build-dataset`, `train` and `retrospective`. To regenerate every number in this README, `docs/*.md` and
`submission/*.md`:

```bash
cd services/analysis && PYTHONPATH=src uv run python ../../docs/_gen/build.py --install
```

Tests:

```bash
cd services/analysis && uv run pytest -q && uv run ruff check . && uv run mypy src
cd ../../apps/web && npm run lint && npm run typecheck && node --test tests/unit/ && npm run test:e2e
```

Public site: Vercel, static snapshot (`apps/web/vercel.json`; deploy from `apps/web` with
`npx vercel deploy --prod --archive=tgz` after exporting the snapshot). Custom targets and arbitrary candidates need the
live API and say so in the interface. macOS iCloud Desktop only: if `import blindspots` fails after `uv sync`, run
`export PYTHONPATH=src`.

## Known limits

- Few experiments per material setup ({{N_EXP_MIN}} to {{N_EXP_MAX}}) and most rows are "flame kept burning" ({{POS_PCT}}).
- All ISS data are at about 1 atm ({{P_MIN}} to {{P_MAX}} kPa), so predictions at other pressures rest on an assumption.
- Many "sustained" labels are implied by list order in the source matrices. Airflow provenance: {{FLOW_PROVENANCE}}

More: [docs/limitations.md](docs/limitations.md). Future work (not implemented): [docs/future-work.md](docs/future-work.md).

## Documentation

[architecture](docs/architecture.md) | [data sources](docs/data-sources.md) | [scientific methodology](docs/scientific-methodology.md) | [validation](docs/validation.md) |
[evidence report](docs/evidence-report.md) | [limitations](docs/limitations.md) | [demo script](docs/demo-script.md) | [future work](docs/future-work.md) |
[decisions](docs/decisions.md) | [API](docs/API.md) | [contracts](docs/CONTRACTS.md)

## Licence and attribution

NASA PSI data (BASS, BASS-II, Saffire) are released by NASA under CC0-1.0; NTRS documents are cited with their NTRS
identifiers. Source files are never modified; derived tables are labelled as interpretations. Blind Spots is an
independent project and is **not endorsed by NASA**; it uses no NASA logos or branding. Fonts: Outfit and Doto (Google
Fonts, SIL Open Font License) and Geist Mono (SIL Open Font License 1.1). {{LICENSE_LINE}}
