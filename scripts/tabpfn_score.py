#!/usr/bin/env python3
"""TabPFN meal-fit score (Prior Labs track). Falls back to sklearn-style heuristic if tabpfn missing."""
import json
import sys

def heuristic(features: dict) -> dict:
    diners = float(features.get("diners", 2))
    allergies = float(features.get("allergy_count", 0))
    pantry_len = float(features.get("pantry_token_count", 10))
    steps = float(features.get("step_count", 5))
    spicy = float(features.get("spicy_flag", 0))
    memory_pos = float(features.get("memory_positive", 0))
    score = 70 + min(pantry_len, 20) * 0.5 - allergies * 8 - spicy * 10 + memory_pos * 12
    score = max(5, min(98, score))
    return {
        "score": int(round(score)),
        "source": "heuristic-fallback",
        "reason": "Install tabpfn in .venv for TabPFN classifier (pip install tabpfn)",
    }


def tabpfn_predict(features: dict) -> dict:
    import numpy as np

    # Tiny in-context dataset: past household meal outcomes (synthetic + extensible via CSV later)
    X_train = np.array(
        [
            [2, 0, 12, 4, 0, 1],
            [3, 1, 8, 6, 1, 0],
            [4, 2, 15, 5, 0, 1],
            [2, 0, 20, 3, 0, 1],
            [3, 0, 6, 7, 1, 0],
        ],
        dtype=np.float32,
    )
    y_train = np.array([1, 0, 1, 1, 0], dtype=np.int64)

    x = np.array(
        [
            [
                float(features.get("diners", 2)),
                float(features.get("allergy_count", 0)),
                float(features.get("pantry_token_count", 10)),
                float(features.get("step_count", 5)),
                float(features.get("spicy_flag", 0)),
                float(features.get("memory_positive", 0)),
            ]
        ],
        dtype=np.float32,
    )

    from tabpfn import TabPFNClassifier

    clf = TabPFNClassifier(device="cpu")
    clf.fit(X_train, y_train)
    proba = clf.predict_proba(x)[0][1]
    score = int(round(proba * 100))
    return {
        "score": score,
        "source": "tabpfn",
        "reason": "TabPFN classified cook-likelihood from pantry + allergy features",
    }


def main() -> None:
    raw = sys.stdin.read()
    features = json.loads(raw) if raw.strip() else {}
    try:
        out = tabpfn_predict(features)
    except Exception:
        out = heuristic(features)
    print(json.dumps(out))


if __name__ == "__main__":
    main()
