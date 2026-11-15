"""Binary Gaussian-process classifier with a Laplace approximation.

Follows Rasmussen & Williams (2006): Alg. 3.1 (mode), Alg. 3.2 (predictions), Alg. 5.1 (marginal
likelihood and gradients), adapted to a non-zero prior mean m(x): f = m + g, g ~ GP(0, k).

Hyperparameter vector theta = [log l_1..log l_d, log signal_var, b0 (, b1)]; the mean parameters
are on their natural scale. MAP-II priors are Gaussian on the *log* parameter (i.e. log-normal on
the parameter); the Jacobian term is not included, so the MAP is taken in log space.
"""

from __future__ import annotations

from collections.abc import Iterable, Mapping
from dataclasses import dataclass
from typing import Any

import numpy as np
from numpy.typing import ArrayLike, NDArray
from scipy.linalg import LinAlgError, cho_solve, cholesky, solve_triangular
from scipy.optimize import minimize
from scipy.spatial.distance import cdist

from blindspots.uncertainty.decomposition import (
    N_NODES_DEFAULT,
    decompose_latent,
    gauss_hermite_probability,
    sigmoid,
    softplus,
)

FloatArray = NDArray[np.float64]

_LOG_L_BOUNDS = (float(np.log(0.05)), float(np.log(100.0)))
_LOG_SF2_BOUNDS = (float(np.log(0.05)), float(np.log(400.0)))
_B0_BOUNDS = (-15.0, 15.0)
_B1_BOUNDS = (-3.0, 3.0)
_FAIL_VALUE = 1e10


@dataclass
class _Mode:
    a: FloatArray  # K^{-1}(f - m)
    f: FloatArray
    pi: FloatArray
    sW: FloatArray
    L: FloatArray  # chol(B), lower
    lml: float


def _sq_exp(A: FloatArray, B: FloatArray, ls: FloatArray, sf2: float) -> FloatArray:
    d2 = cdist(A / ls, B / ls, "sqeuclidean")
    return np.asarray(sf2 * np.exp(-0.5 * d2), dtype=float)


def _mean_fn(X: FloatArray, mean: str, mp: FloatArray) -> FloatArray:
    if mean == "constant":
        return np.full(X.shape[0], mp[0], dtype=float)
    return np.asarray(mp[0] + mp[1] * (X[:, 0] - 21.0), dtype=float)


def _loglik(f: FloatArray, y: FloatArray) -> float:
    return float(np.sum(y * f - softplus(f)))


def _chol_retry(B: FloatArray) -> FloatArray:
    jitter = 0.0
    for _ in range(8):
        try:
            return np.asarray(cholesky(B + jitter * np.eye(B.shape[0]), lower=True), dtype=float)
        except LinAlgError:
            jitter = 1e-10 if jitter == 0.0 else jitter * 10.0
    raise LinAlgError("Cholesky of B failed after retries")


def _find_mode(K: FloatArray, y: FloatArray, m: FloatArray, tol: float = 1e-10, max_iter: int = 200) -> _Mode:
    """Newton iterations with backtracking line search on Psi(a) = log p(y|m+Ka) - a'Ka/2."""
    n = y.shape[0]
    a = np.zeros(n)
    f = m.copy()
    psi = _loglik(f, y)
    for _ in range(max_iter):
        pi = sigmoid(f)
        W = pi * (1.0 - pi)
        sW = np.sqrt(W)
        L = _chol_retry(np.eye(n) + sW[:, None] * K * sW[None, :])
        b = W * (f - m) + (y - pi)
        a_new = b - sW * cho_solve((L, True), sW * (K @ b))
        step = 1.0
        accepted = False
        for _ in range(40):
            a_try = a + step * (a_new - a)
            f_try = m + K @ a_try
            psi_try = _loglik(f_try, y) - 0.5 * float(a_try @ (f_try - m))
            if np.isfinite(psi_try) and psi_try >= psi - 1e-12 * max(1.0, abs(psi)):
                accepted = True
                break
            step *= 0.5
        if not accepted:
            break
        delta = float(np.max(np.abs(a_try - a)))
        a, f, psi = a_try, f_try, psi_try
        if delta < tol:
            break
    pi = sigmoid(f)
    W = pi * (1.0 - pi)
    sW = np.sqrt(W)
    L = _chol_retry(np.eye(n) + sW[:, None] * K * sW[None, :])
    lml = _loglik(f, y) - 0.5 * float(a @ (f - m)) - float(np.sum(np.log(np.diag(L))))
    return _Mode(a=a, f=f, pi=pi, sW=sW, L=L, lml=lml)


def _lml_and_grad(
    X: FloatArray,
    y: FloatArray,
    ls: FloatArray,
    sf2: float,
    mp: FloatArray,
    mean: str,
    jitter: float,
    want_grad: bool = True,
) -> tuple[float, FloatArray, _Mode]:
    """Laplace log marginal likelihood and its gradient (R&W Alg. 5.1) w.r.t. theta."""
    n, d = X.shape
    K0 = _sq_exp(X, X, ls, sf2)
    K = K0 + jitter * np.eye(n)
    m = _mean_fn(X, mean, mp)
    mode = _find_mode(K, y, m)
    n_theta = d + 1 + mp.size
    grad = np.zeros(n_theta)
    if not want_grad:
        return mode.lml, grad, mode
    sW, L, pi = mode.sW, mode.L, mode.pi
    g = y - pi  # = a at the mode
    # R = W^1/2 B^-1 W^1/2
    R = sW[:, None] * cho_solve((L, True), np.diag(sW))
    W = sW**2
    sigma_diag = np.diag(K) - np.sum((K @ R) * K, axis=1)  # diag((K^-1 + W)^-1)
    s2 = -0.5 * sigma_diag * W * (1.0 - 2.0 * pi)  # d log q / d f_hat_i

    def cov_grad(C: FloatArray) -> float:
        s1 = 0.5 * float(g @ C @ g) - 0.5 * float(np.sum(R * C))
        b = C @ g
        s3 = b - K @ (R @ b)
        return s1 + float(s2 @ s3)

    for k in range(d):
        diff2 = (X[:, k][:, None] - X[:, k][None, :]) ** 2
        grad[k] = cov_grad(K0 * diff2 / ls[k] ** 2)
    grad[d] = cov_grad(K0)
    # mean parameters: explicit a'dm plus implicit through the mode, df/dm = (I + KW)^-1 dm
    dms = [np.ones(n)] + ([X[:, 0] - 21.0] if mean == "linear_o2" else [])
    for j, dm in enumerate(dms):
        s3 = dm - K @ (R @ dm)
        grad[d + 1 + j] = float(g @ dm) + float(s2 @ s3)
    return mode.lml, grad, mode


class GPLaplaceClassifier:
    """Binary GP classifier (logit link) with Laplace approximation (R&W 2006, Alg. 3.1/3.2/5.1).

    Inputs are already-transformed coordinates (n, d); with mean="linear_o2" column 0 must be
    z_o2. ARD squared-exponential kernel; hyperparameters fitted by MAP-II (log-normal priors);
    any subset may be fixed by name: "l_o2", "l_flow", "l_p" (d == 3; otherwise "l_0", "l_1", ...),
    "signal_var", "b0", "b1". "mean" is shorthand for all mean parameters.
    """

    def __init__(
        self,
        length_scales: ArrayLike,
        signal_var: float = 1.0,
        mean: str = "constant",
        fixed: Iterable[str] = (),
        priors: Mapping[str, tuple[float, float] | None] | None = None,
        n_restarts: int = 8,
        seed: int = 0,
        jitter: float = 1e-8,
        mean_params: ArrayLike | None = None,
    ) -> None:
        if mean not in ("constant", "linear_o2"):
            raise ValueError("mean must be 'constant' or 'linear_o2'")
        ls = np.atleast_1d(np.asarray(length_scales, dtype=float)).ravel()
        if ls.size == 0 or np.any(ls <= 0) or signal_var <= 0:
            raise ValueError("length scales and signal_var must be positive")
        self.mean = mean
        self.length_scales: FloatArray = ls
        self.signal_var = float(signal_var)
        n_mp = 1 if mean == "constant" else 2
        mp = np.zeros(n_mp) if mean_params is None else np.asarray(mean_params, dtype=float).ravel()
        if mp.size != n_mp:
            raise ValueError(f"mean_params must have {n_mp} entries")
        self.mean_params: FloatArray = mp
        self.n_restarts = int(n_restarts)
        self.seed = int(seed)
        self.jitter = float(jitter)
        d = ls.size
        self.param_names: list[str] = (
            (["l_o2", "l_flow", "l_p"] if d == 3 else [f"l_{i}" for i in range(d)])
            + ["signal_var", "b0"]
            + (["b1"] if mean == "linear_o2" else [])
        )
        self.fixed: tuple[str, ...] = self._normalise_fixed(fixed)
        self.priors: dict[str, tuple[float, float]] = self._build_priors(priors)
        self.X: FloatArray | None = None
        self.y: FloatArray | None = None
        self._mode: _Mode | None = None
        self.fit_info_: dict[str, Any] = {}

    # ---------------------------------------------------------------- construction helpers
    @classmethod
    def default(
        cls,
        mean: str = "constant",
        n_restarts: int = 8,
        seed: int = 0,
        l_p: float = 0.3,
        fixed: Iterable[str] = ("l_p",),
    ) -> GPLaplaceClassifier:
        """Project defaults for (z_o2, z_flow, z_p): l = (3, 1, l_p), l_p fixed, signal var 4."""
        return cls([3.0, 1.0, l_p], signal_var=4.0, mean=mean, fixed=fixed, n_restarts=n_restarts, seed=seed)

    def _normalise_fixed(self, fixed: Iterable[str]) -> tuple[str, ...]:
        out: list[str] = []
        for name in fixed:
            if name == "mean":
                out += [n for n in self.param_names if n.startswith("b")]
            elif name == "length_scales":
                out += [n for n in self.param_names if n.startswith("l_")]
            elif name in self.param_names:
                out.append(name)
            else:
                raise ValueError(f"unknown hyperparameter {name!r}; valid: {self.param_names}")
        return tuple(n for n in self.param_names if n in set(out))

    def _build_priors(
        self, priors: Mapping[str, tuple[float, float] | None] | None
    ) -> dict[str, tuple[float, float]]:
        sd = 0.75
        out: dict[str, tuple[float, float]] = {"signal_var": (float(np.log(4.0)), sd), "b0": (0.0, 3.0)}
        if "b1" in self.param_names:
            out["b1"] = (0.0, 1.0)
        if len(self.length_scales) == 3:
            out["l_o2"] = (float(np.log(3.0)), sd)
            out["l_flow"] = (float(np.log(1.0)), sd)
        for k, v in (priors or {}).items():
            if k not in self.param_names:
                raise ValueError(f"unknown prior key {k!r}")
            if v is None:
                out.pop(k, None)
            else:
                out[k] = (float(v[0]), float(v[1]))
        return out

    # ---------------------------------------------------------------- parameter vector
    def _theta(self) -> FloatArray:
        return np.concatenate([np.log(self.length_scales), [np.log(self.signal_var)], self.mean_params])

    def _set_theta(self, th: FloatArray) -> None:
        d = self.length_scales.size
        self.length_scales = np.exp(th[:d])
        self.signal_var = float(np.exp(th[d]))
        self.mean_params = np.asarray(th[d + 1 :], dtype=float).copy()

    def _unpack(self, th: FloatArray) -> tuple[FloatArray, float, FloatArray]:
        d = self.length_scales.size
        return np.exp(th[:d]), float(np.exp(th[d])), np.asarray(th[d + 1 :], dtype=float)

    def _bounds(self) -> list[tuple[float, float]]:
        d = self.length_scales.size
        b = [_LOG_L_BOUNDS] * d + [_LOG_SF2_BOUNDS, _B0_BOUNDS]
        if self.mean == "linear_o2":
            b.append(_B1_BOUNDS)
        return b

    def _log_prior(self, th: FloatArray) -> tuple[float, FloatArray]:
        val = 0.0
        grad = np.zeros_like(th)
        for i, name in enumerate(self.param_names):
            if name in self.priors:
                mu, s = self.priors[name]
                val += -0.5 * ((th[i] - mu) / s) ** 2
                grad[i] = -(th[i] - mu) / s**2
        return val, grad

    # ---------------------------------------------------------------- fitting
    @staticmethod
    def _check_data(X: ArrayLike, y: ArrayLike) -> tuple[FloatArray, FloatArray]:
        Xa = np.atleast_2d(np.asarray(X, dtype=float))
        ya = np.asarray(y, dtype=float).ravel()
        if Xa.shape[0] != ya.shape[0]:
            raise ValueError("X and y have different lengths")
        if not np.isin(ya, (0.0, 1.0)).all():
            raise ValueError("y must be 0/1")
        if not np.all(np.isfinite(Xa)):
            raise ValueError("X contains non-finite values")
        return Xa, ya

    def _solve(self) -> None:
        assert self.X is not None and self.y is not None
        _, _, self._mode = _lml_and_grad(
            self.X, self.y, self.length_scales, self.signal_var, self.mean_params, self.mean,
            self.jitter, want_grad=False,
        )  # fmt: skip

    def fit(self, X: ArrayLike, y: ArrayLike) -> GPLaplaceClassifier:
        """MAP-II fit of the free hyperparameters (deterministic, seeded restarts), then the mode."""
        Xa, ya = self._check_data(X, y)
        if Xa.shape[1] != self.length_scales.size:
            raise ValueError("X has the wrong number of columns")
        self.X, self.y = Xa, ya
        free = np.array([nm not in self.fixed for nm in self.param_names])
        if free.any() and Xa.shape[0] > 0:
            self._optimise(free)
        self._solve()
        return self

    def _objective(
        self, th_free: FloatArray, th_full: FloatArray, free: NDArray[np.bool_]
    ) -> tuple[float, FloatArray]:
        assert self.X is not None and self.y is not None
        th = th_full.copy()
        th[free] = th_free
        try:
            ls, sf2, mp = self._unpack(th)
            lml, g, _ = _lml_and_grad(self.X, self.y, ls, sf2, mp, self.mean, self.jitter)
            lp, gp = self._log_prior(th)
            val = -(lml + lp)
            grad = -(g + gp)
            if not (np.isfinite(val) and np.all(np.isfinite(grad))):
                return _FAIL_VALUE, np.zeros(int(free.sum()))
            return float(val), grad[free]
        except (LinAlgError, FloatingPointError, ValueError):
            return _FAIL_VALUE, np.zeros(int(free.sum()))

    def _optimise(self, free: NDArray[np.bool_]) -> None:
        bounds_all = self._bounds()
        lo = np.array([b[0] for b in bounds_all])
        hi = np.array([b[1] for b in bounds_all])
        # Only free parameters are clipped into the optimizer bounds; fixed values stay exactly as set.
        th0 = self._theta()
        th0[free] = np.clip(th0[free], lo[free], hi[free])
        rng = np.random.default_rng(self.seed)
        scale = np.array(
            [0.5] * self.length_scales.size + [0.5, 1.0] + ([0.3] if self.mean == "linear_o2" else [])
        )
        best_val, best_th, n_ok = np.inf, th0, 0
        for r in range(max(1, self.n_restarts)):
            start = th0.copy()
            if r > 0:
                start = np.clip(th0 + rng.normal(size=th0.size) * scale, lo, hi)
            start[~free] = th0[~free]
            res = minimize(
                self._objective,
                start[free],
                args=(th0, free),
                jac=True,
                method="L-BFGS-B",
                bounds=[b for b, f in zip(bounds_all, free, strict=True) if f],
                options={"maxiter": 200},
            )
            if res.success and res.fun < _FAIL_VALUE:
                n_ok += 1
            if res.fun < best_val - 1e-9:
                best_val = float(res.fun)
                best_th = th0.copy()
                best_th[free] = res.x
        self._set_theta(best_th)
        self.fit_info_ = {"objective": best_val, "n_restarts": self.n_restarts, "n_converged": n_ok}

    def _require(self) -> _Mode:
        if self._mode is None or self.X is None or self.y is None:
            raise RuntimeError("model is not fitted")
        return self._mode

    # ---------------------------------------------------------------- prediction
    def prior_var(self) -> float:
        return self.signal_var

    def _cross(self, A: FloatArray) -> FloatArray:
        assert self.X is not None
        return _sq_exp(A, self.X, self.length_scales, self.signal_var)

    def _v(self, A: FloatArray) -> FloatArray:
        mode = self._require()
        return np.asarray(
            solve_triangular(mode.L, mode.sW[:, None] * self._cross(A).T, lower=True), dtype=float
        )

    def latent(self, Xs: ArrayLike) -> tuple[FloatArray, FloatArray]:
        """Latent predictive mean and variance (R&W Alg. 3.2, with prior mean)."""
        mode = self._require()
        As = np.atleast_2d(np.asarray(Xs, dtype=float))
        assert self.y is not None
        Ks = self._cross(As)
        mean = _mean_fn(As, self.mean, self.mean_params) + Ks @ (self.y - mode.pi)
        v = solve_triangular(mode.L, mode.sW[:, None] * Ks.T, lower=True)
        var = np.maximum(self.signal_var - np.sum(v**2, axis=0), 1e-12)
        return np.asarray(mean, dtype=float), np.asarray(var, dtype=float)

    def latent_cov(self, A: ArrayLike, B: ArrayLike) -> FloatArray:
        """Posterior covariance k(A,B) - k(A,X) W^1/2 B^-1 W^1/2 k(X,B)."""
        Aa = np.atleast_2d(np.asarray(A, dtype=float))
        Ba = np.atleast_2d(np.asarray(B, dtype=float))
        return np.asarray(
            _sq_exp(Aa, Ba, self.length_scales, self.signal_var) - self._v(Aa).T @ self._v(Ba), dtype=float
        )

    def predict_proba(self, Xs: ArrayLike, n_nodes: int = N_NODES_DEFAULT) -> FloatArray:
        mean, var = self.latent(Xs)
        return gauss_hermite_probability(mean, var, max(n_nodes, 40))[0]

    def uncertainty(self, Xs: ArrayLike, n_nodes: int = N_NODES_DEFAULT) -> dict[str, FloatArray]:
        mean, var = self.latent(Xs)
        out = decompose_latent(mean, var, max(n_nodes, 40))
        std = np.sqrt(var)
        out["latent_mean"] = mean
        out["latent_std"] = std
        out["latent_std_ratio"] = std / np.sqrt(self.prior_var())
        return out

    # ---------------------------------------------------------------- model evidence / updates
    def log_marginal_likelihood(self) -> float:
        """Laplace approximation of log p(y | X, theta) (without the hyperprior)."""
        return float(self._require().lml)

    def log_marginal_likelihood_gradient(self) -> dict[str, float]:
        """Analytic gradient of the Laplace LML w.r.t. log l_i, log signal_var and mean parameters."""
        self._require()
        assert self.X is not None and self.y is not None
        _, g, _ = _lml_and_grad(
            self.X, self.y, self.length_scales, self.signal_var, self.mean_params, self.mean, self.jitter
        )
        return dict(zip(self.param_names, (float(v) for v in g), strict=True))

    def hyperparameters(self) -> dict[str, float]:
        vals = [*self.length_scales.tolist(), self.signal_var, *self.mean_params.tolist()]
        return dict(zip(self.param_names, (float(v) for v in vals), strict=True))

    def condition_on(self, X_new: ArrayLike, y_new: ArrayLike) -> GPLaplaceClassifier:
        """New model on augmented data with hyperparameters held fixed (mode recomputed)."""
        self._require()
        assert self.X is not None and self.y is not None
        Xn, yn = self._check_data(X_new, y_new)
        new = GPLaplaceClassifier(
            self.length_scales,
            self.signal_var,
            self.mean,
            fixed=self.param_names,
            priors=self.priors,
            n_restarts=self.n_restarts,
            seed=self.seed,
            jitter=self.jitter,
            mean_params=self.mean_params,
        )
        new.X = np.vstack([self.X, Xn.reshape(-1, self.X.shape[1])])
        new.y = np.concatenate([self.y, yn])
        new._solve()
        return new

    # ---------------------------------------------------------------- serialisation
    def to_dict(self) -> dict[str, Any]:
        self._require()
        assert self.X is not None and self.y is not None
        return {
            "model": "GPLaplaceClassifier",
            "version": 1,
            "mean": self.mean,
            "length_scales": self.length_scales.tolist(),
            "signal_var": self.signal_var,
            "mean_params": self.mean_params.tolist(),
            "fixed": list(self.fixed),
            "priors": {k: [v[0], v[1]] for k, v in self.priors.items()},
            "n_restarts": self.n_restarts,
            "seed": self.seed,
            "jitter": self.jitter,
            "param_names": list(self.param_names),
            "X": self.X.tolist(),
            "y": self.y.astype(int).tolist(),
            "log_marginal_likelihood": self.log_marginal_likelihood(),
            "fit_info": {
                k: (float(v) if isinstance(v, (int, float, np.floating)) else v)
                for k, v in self.fit_info_.items()
            },
        }

    @classmethod
    def from_dict(cls, d: Mapping[str, Any]) -> GPLaplaceClassifier:
        priors: dict[str, tuple[float, float] | None] = {k: (v[0], v[1]) for k, v in d["priors"].items()}
        for name in d["param_names"]:
            priors.setdefault(name, None)  # keep defaults from adding priors that were absent
        model = cls(
            d["length_scales"],
            d["signal_var"],
            d["mean"],
            fixed=d["fixed"],
            priors=priors,
            n_restarts=d["n_restarts"],
            seed=d["seed"],
            jitter=d["jitter"],
            mean_params=d["mean_params"],
        )
        model.X, model.y = cls._check_data(d["X"], d["y"])
        model._solve()
        model.fit_info_ = dict(d.get("fit_info", {}))
        return model

    def __repr__(self) -> str:
        return f"GPLaplaceClassifier(mean={self.mean!r}, hyper={self.hyperparameters()})"
