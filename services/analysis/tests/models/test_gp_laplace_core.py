from __future__ import annotations

import numpy as np
import pytest
from scipy.optimize import approx_fprime
from sklearn.gaussian_process import GaussianProcessClassifier
from sklearn.gaussian_process.kernels import RBF, ConstantKernel

from blindspots.models.gp_laplace import GPLaplaceClassifier, _lml_and_grad


def synthetic_2d(n: int = 30, seed: int = 1) -> tuple[np.ndarray, np.ndarray]:
    rng = np.random.default_rng(seed)
    X = rng.uniform(-2, 2, size=(n, 2))
    p = 1 / (1 + np.exp(-(2.0 * X[:, 0] - 1.0 * X[:, 1] + 0.3)))
    y = (rng.uniform(size=n) < p).astype(int)
    return X, y


def synthetic_3d(n: int = 40, seed: int = 2) -> tuple[np.ndarray, np.ndarray]:
    rng = np.random.default_rng(seed)
    o2 = rng.uniform(15, 35, n)
    flow = rng.uniform(0, 3, n)
    pz = rng.normal(0, 0.02, n)
    X = np.column_stack([o2, flow, pz])
    p = 1 / (1 + np.exp(-(0.5 * (o2 - 24) + 0.8 * (flow - 1.2))))
    return X, (rng.uniform(size=n) < p).astype(int)


def test_matches_sklearn_fixed_kernel() -> None:
    X, y = synthetic_2d()
    ls, sf2 = [1.3, 0.8], 2.5
    gpc = GaussianProcessClassifier(kernel=ConstantKernel(sf2, "fixed") * RBF(ls, "fixed"), optimizer=None)
    gpc.fit(X, y)
    est = gpc.base_estimator_
    ours = GPLaplaceClassifier(ls, sf2, fixed=["l_0", "l_1", "signal_var", "b0"], jitter=1e-10).fit(X, y)
    assert ours._mode is not None
    np.testing.assert_allclose(ours._mode.f, est.f_cached, atol=1e-6)
    Xs = np.random.default_rng(5).uniform(-2.5, 2.5, size=(12, 2))
    Ks = est.kernel_(est.X_train_, Xs)
    mean_sk = Ks.T @ (y - est.pi_)
    v = np.linalg.solve(est.L_, est.W_sr_[:, None] * Ks)
    var_sk = est.kernel_.diag(Xs) - np.einsum("ij,ij->j", v, v)
    mean, var = ours.latent(Xs)
    np.testing.assert_allclose(mean, mean_sk, atol=1e-6)
    np.testing.assert_allclose(var, var_sk, atol=1e-6)
    # posterior covariance diagonal agrees with latent variance
    np.testing.assert_allclose(np.diag(ours.latent_cov(Xs, Xs)), var, atol=1e-8)
    cov = ours.latent_cov(Xs, Xs)
    np.testing.assert_allclose(cov, cov.T, atol=1e-9)


@pytest.mark.parametrize("mean", ["constant", "linear_o2"])
def test_lml_gradient_matches_finite_differences(mean: str) -> None:
    X, y = synthetic_3d(25)
    mp = np.array([0.2]) if mean == "constant" else np.array([0.2, 0.05])
    theta = np.concatenate([np.log([4.0, 1.2, 0.4]), [np.log(3.0)], mp])
    d = 3

    def fun(th: np.ndarray) -> float:
        return _lml_and_grad(
            X, y.astype(float), np.exp(th[:d]), float(np.exp(th[d])), th[d + 1 :], mean, 1e-8, False
        )[0]

    _, grad, _ = _lml_and_grad(
        X, y.astype(float), np.exp(theta[:d]), float(np.exp(theta[d])), theta[d + 1 :], mean, 1e-8
    )
    fd = approx_fprime(theta, fun, 1e-6)
    np.testing.assert_allclose(grad, fd, rtol=2e-4, atol=2e-5)


def test_public_gradient_names() -> None:
    X, y = synthetic_3d(20)
    m = GPLaplaceClassifier.default(mean="linear_o2", n_restarts=1).fit(X, y)
    assert set(m.log_marginal_likelihood_gradient()) == {"l_o2", "l_flow", "l_p", "signal_var", "b0", "b1"}


def test_predict_proba_range_and_shapes() -> None:
    X, y = synthetic_3d()
    m = GPLaplaceClassifier.default(n_restarts=2).fit(X, y)
    Xs = np.random.default_rng(0).uniform([5, 0, -0.1], [50, 5, 0.1], size=(17, 3))
    p = m.predict_proba(Xs)
    assert p.shape == (17,) and np.all((p >= 0) & (p <= 1))
    mu, var = m.latent(Xs)
    assert mu.shape == var.shape == (17,) and np.all(var > 0)
    assert m.latent_cov(Xs[:4], Xs[:6]).shape == (4, 6)
    assert m.prior_var() == m.signal_var
    assert np.isfinite(m.log_marginal_likelihood())


def test_uncertainty_decomposition() -> None:
    X, y = synthetic_3d(50)
    m = GPLaplaceClassifier.default(n_restarts=2).fit(X, y)
    near = X[:10]
    far = near.copy()
    far[:, 0] += 60.0
    far[:, 1] += 20.0
    un, uf = m.uncertainty(near), m.uncertainty(far)
    for u in (un, uf):
        np.testing.assert_allclose(u["total"], u["aleatoric"] + u["epistemic"], atol=1e-9)
        assert np.all(u["epistemic"] >= 0)
        assert np.all(u["total"] <= np.log(2) + 1e-9)
        assert set(u) >= {
            "p_mean",
            "total",
            "aleatoric",
            "epistemic",
            "latent_mean",
            "latent_std",
            "latent_std_ratio",
        }
    assert uf["epistemic"].mean() > un["epistemic"].mean()
    assert uf["latent_std_ratio"].mean() > un["latent_std_ratio"].mean()
    assert np.all(uf["latent_std_ratio"] <= 1.0 + 1e-9)


def test_condition_on_equals_fresh_fit() -> None:
    X, y = synthetic_3d(30)
    m = GPLaplaceClassifier.default(mean="linear_o2", n_restarts=2).fit(X[:25], y[:25])
    cond = m.condition_on(X[25:], y[25:])
    hp = m.hyperparameters()
    fresh = GPLaplaceClassifier(
        [hp["l_o2"], hp["l_flow"], hp["l_p"]], hp["signal_var"], "linear_o2",
        fixed=m.param_names, mean_params=[hp["b0"], hp["b1"]],
    ).fit(X, y)  # fmt: skip
    Xs = np.random.default_rng(9).uniform([10, 0, -0.05], [40, 4, 0.05], size=(8, 3))
    np.testing.assert_allclose(cond.latent(Xs)[0], fresh.latent(Xs)[0], atol=1e-8)
    np.testing.assert_allclose(cond.latent(Xs)[1], fresh.latent(Xs)[1], atol=1e-8)
    assert cond.log_marginal_likelihood() == pytest.approx(fresh.log_marginal_likelihood())
    assert m.X is not None and m.X.shape[0] == 25  # original unchanged
    assert cond.hyperparameters() == hp


def test_determinism() -> None:
    X, y = synthetic_3d()
    a = GPLaplaceClassifier.default(n_restarts=3, seed=4).fit(X, y)
    b = GPLaplaceClassifier.default(n_restarts=3, seed=4).fit(X, y)
    assert a.hyperparameters() == b.hyperparameters()
    np.testing.assert_array_equal(a.predict_proba(X[:5]), b.predict_proba(X[:5]))


def test_fit_improves_posterior_and_respects_fixed() -> None:
    X, y = synthetic_3d(40)
    m = GPLaplaceClassifier.default(n_restarts=3).fit(X, y)
    assert m.hyperparameters()["l_p"] == 0.3
    free = GPLaplaceClassifier([3.0, 1.0, 0.3], 4.0, fixed=["l_p"], n_restarts=1)
    free.fit(X, y)
    assert free.hyperparameters()["l_p"] == 0.3


def test_to_dict_round_trip_json_safe() -> None:
    import json

    X, y = synthetic_3d()
    m = GPLaplaceClassifier.default(mean="linear_o2", n_restarts=2).fit(X, y)
    d = json.loads(json.dumps(m.to_dict()))
    m2 = GPLaplaceClassifier.from_dict(d)
    Xs = X[:6] + 0.1
    np.testing.assert_allclose(m.predict_proba(Xs), m2.predict_proba(Xs), atol=1e-10)
    np.testing.assert_allclose(m.latent(Xs)[1], m2.latent(Xs)[1], atol=1e-10)
    assert m.hyperparameters() == pytest.approx(m2.hyperparameters())
    assert m2.log_marginal_likelihood() == pytest.approx(m.log_marginal_likelihood(), abs=1e-8)
    assert m2.priors == m.priors and m2.fixed == m.fixed


def test_single_class_and_unfitted() -> None:
    X, _ = synthetic_3d(10)
    m = GPLaplaceClassifier.default(n_restarts=1).fit(X, np.ones(10))
    assert np.all(m.predict_proba(X) > 0.5)
    with pytest.raises(RuntimeError):
        GPLaplaceClassifier.default().predict_proba(X)
    with pytest.raises(ValueError):
        GPLaplaceClassifier([1.0, 1.0, 1.0], fixed=["nope"])
