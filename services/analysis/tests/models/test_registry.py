"""Registry tests on synthetic fixture data only (never real measurements)."""

from __future__ import annotations

import numpy as np
import pandas as pd
import pytest

from blindspots.models.registry import (
    ArtifactMissing,
    TrainConfig,
    load_registry,
    make_model_version,
    save_registry,
    train_registry,
)

GROUP = "pmma_rod__opposed"


def fixture_frames(n_exp: int = 12, seed: int = 3) -> tuple[pd.DataFrame, pd.DataFrame]:
    rng = np.random.default_rng(seed)
    rows, exps = [], []
    for e in range(n_exp):
        o2 = 15.0 + 7.0 * rng.random()
        camp = "FIXTURE/A" if e % 2 == 0 else "FIXTURE/B"
        exps.append({"experiment_id": f"fixture:{e}", "oxygen_percent_initial": o2})
        for s, flow in enumerate([20.0, 8.0, 3.0, 1.0, 0.4]):
            label = int(o2 + 1.5 * np.log1p(flow) + rng.normal(0, 0.8) > 19.0)
            rows.append(
                {
                    "observation_id": f"fixture:{e}#s{s}",
                    "experiment_id": f"fixture:{e}",
                    "campaign_group": camp,
                    "material_family": "pmma_rod",
                    "flame_configuration": "opposed",
                    "step_index": s,
                    "oxygen_percent": o2 - 0.1 * s,
                    "airflow_cm_s": flow,
                    "pressure_for_analysis_kpa": 101.3,
                    "label": label,
                    "included_in_training": True,
                    "exclusion_reason": None,
                    "confidence": "medium" if s % 2 else "high",
                    "quality_flags": ["o2_interpolated"] if s else [],
                    "extinction_mode": None,
                }
            )
    return pd.DataFrame(rows), pd.DataFrame(exps)


def fixture_config(**kw: object) -> TrainConfig:
    base: dict[str, object] = {
        "n_restarts": 2,
        "cv_repeats": 2,
        "cv_seeds": (0, 1),
        "n_bootstrap": 40,
        "ensemble_members": 8,
        "n_permutations": 60,
    }
    base.update(kw)
    return TrainConfig(**base)  # type: ignore[arg-type]


def test_model_version_format_and_config_sensitivity() -> None:
    v = make_model_version("abcdef0123456789", TrainConfig())
    assert v.startswith("gp-laplace-v1+abcdef01.")
    assert len(v.split(".")[-1]) == 6
    assert v != make_model_version("abcdef0123456789", TrainConfig(pressure_length_scale=0.6))
    assert TrainConfig.from_dict(TrainConfig().to_dict()) == TrainConfig()


def test_training_is_deterministic_and_round_trips(tmp_path) -> None:  # type: ignore[no-untyped-def]
    obs, exp = fixture_frames()
    cfg = fixture_config()
    r1 = train_registry(cfg, obs, exp, "feedc0de1234")
    r2 = train_registry(cfg, obs, exp, "feedc0de1234")
    d1, d2 = tmp_path / "a", tmp_path / "b"
    save_registry(r1, d1)
    save_registry(r2, d2)
    m1 = (d1 / r1.model_version / "manifest.json").read_text()
    import json

    j1 = json.loads(m1)
    j2 = json.loads((d2 / r2.model_version / "manifest.json").read_text())
    assert j1["group_hashes"] == j2["group_hashes"]
    assert j1["model_version"] == j2["model_version"]
    assert (d1 / "LATEST").read_text().strip() == r1.model_version

    gm = r1.groups[GROUP]
    assert gm.model_status == "modeled" and gm.model is not None
    assert gm.mean_function in ("constant", "linear_o2")
    assert gm.model.fixed == ("l_p",)
    assert gm.model.length_scales[2] == pytest.approx(0.3)

    loaded = load_registry(d1)
    assert loaded.model_version == r1.model_version and loaded.config == cfg
    gl = loaded.groups[GROUP]
    assert gl.model is not None
    Xq = np.array([[18.0, 1.0, 0.0], [21.0, 2.5, 0.0]])
    np.testing.assert_allclose(gl.model.predict_proba(Xq), gm.model.predict_proba(Xq), atol=1e-8)
    assert gl.training_set["label_counts"] == gm.training_set["label_counts"]


def test_insufficient_group_is_recorded_without_model() -> None:
    obs, exp = fixture_frames(n_exp=3)
    reg = train_registry(fixture_config(), obs, exp, "feedc0de1234")
    gm = reg.groups[GROUP]
    assert gm.model is None and gm.model_status == "insufficient_data" and gm.model_reason


def test_missing_artifacts_raise(tmp_path) -> None:  # type: ignore[no-untyped-def]
    with pytest.raises(ArtifactMissing):
        load_registry(tmp_path)
