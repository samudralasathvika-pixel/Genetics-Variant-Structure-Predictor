import os
import pickle
import logging
from pathlib import Path

import numpy as np
import pandas as pd
from flask import Flask, request, jsonify
from flask_cors import CORS

logging.basicConfig(level=logging.INFO)
log = logging.getLogger("predictor")

MODEL_PATH = Path(__file__).parent / "model.pkl"
with open(MODEL_PATH, "rb") as f:
    MODEL = pickle.load(f)
log.info("Model loaded: %s", type(MODEL).__name__)

FEATURE_ORDER = list(getattr(MODEL, "feature_names_in_", [
    "wt_psic", "dpsic", "plddt", "mt_psic", "plddt_mean",
    "kdHydrophobicity_DELTAmn", "Volume_(A3)_n", "psic_ratio", "plddt_diff",
]))

app = Flask(__name__)
CORS(app)


def expand_features(row: dict) -> dict:
    """Take 6 user-provided features, derive the 9 the model needs."""
    wt_psic = float(row["wt_psic"])
    mt_psic = float(row["mt_psic"])
    plddt = float(row["plddt"])
    mean_plddt = float(row["mean_plddt"])
    hydro_change = float(row["hydrophobicity_change"])
    volume = float(row["volume"])

    dpsic = wt_psic - mt_psic
    psic_ratio = mt_psic / wt_psic if wt_psic not in (0, 0.0) else 0.0
    plddt_diff = plddt - mean_plddt

    return {
        "wt_psic": wt_psic,
        "dpsic": dpsic,
        "plddt": plddt,
        "mt_psic": mt_psic,
        "plddt_mean": mean_plddt,
        "kdHydrophobicity_DELTAmn": hydro_change,
        "Volume_(A3)_n": volume,
        "psic_ratio": psic_ratio,
        "plddt_diff": plddt_diff,
    }


def explain(label: int, confidence: float, dpsic: float, plddt: float) -> str:
    if label == 1:
        base = (
            "The model predicts this variant is likely PATHOGENIC. "
            "Structural and evolutionary signals suggest the amino acid "
            "change is likely to disrupt protein function."
        )
    else:
        base = (
            "The model predicts this variant is likely BENIGN. "
            "Structural and evolutionary signals are consistent with a "
            "tolerated amino acid change."
        )
    notes = []
    if abs(dpsic) >= 1.0:
        notes.append(f"large conservation shift (ΔPSIC={dpsic:.2f})")
    if plddt < 50:
        notes.append("low AlphaFold confidence at the mutation site")
    elif plddt >= 90:
        notes.append("very high AlphaFold confidence at the mutation site")
    if confidence < 0.6:
        notes.append("model confidence is moderate — consider additional evidence")
    if notes:
        base += " Notes: " + "; ".join(notes) + "."
    return base


def predict_rows(rows: list[dict]) -> list[dict]:
    expanded = [expand_features(r) for r in rows]
    df = pd.DataFrame(expanded)[FEATURE_ORDER]
    proba = MODEL.predict_proba(df)
    preds = MODEL.predict(df)
    out = []
    for i, p in enumerate(proba):
        path_score = float(p[1])
        label = int(preds[i])
        conf = float(max(p))
        out.append({
            "label": label,
            "prediction": "Pathogenic" if label == 1 else "Benign",
            "confidence": f"{conf * 100:.1f}%",
            "pathogenic_score": f"{path_score:.4f}",
            "dpsic": f"{expanded[i]['dpsic']:.4f}",
            "_dpsic_num": expanded[i]["dpsic"],
            "_plddt_num": expanded[i]["plddt"],
            "_conf_num": conf,
        })
    return out


@app.get("/api/healthz")
def healthz():
    return jsonify({"status": "ok"})


@app.post("/api/predict")
def predict_one():
    data = request.get_json(silent=True) or {}
    required = ["wt_psic", "mt_psic", "plddt", "mean_plddt",
                "hydrophobicity_change", "volume"]
    missing = [k for k in required if k not in data]
    if missing:
        return jsonify({"error": f"Missing fields: {', '.join(missing)}"}), 400
    try:
        result = predict_rows([data])[0]
    except Exception as e:
        log.exception("prediction failed")
        return jsonify({"error": str(e)}), 400
    explanation = explain(result["label"], result["_conf_num"],
                          result["_dpsic_num"], result["_plddt_num"])
    return jsonify({
        "prediction": result["prediction"],
        "label": result["label"],
        "confidence": result["confidence"],
        "pathogenic_score": result["pathogenic_score"],
        "dpsic": result["dpsic"],
        "explanation": explanation,
    })


@app.post("/api/predict/batch")
def predict_batch():
    data = request.get_json(silent=True) or {}
    rows = data.get("rows")
    if not isinstance(rows, list) or not rows:
        return jsonify({"error": "Expected non-empty 'rows' array"}), 400
    try:
        results = predict_rows(rows)
    except Exception as e:
        log.exception("batch prediction failed")
        return jsonify({"error": str(e)}), 400
    cleaned = [{
        "prediction": r["prediction"],
        "label": r["label"],
        "confidence": r["confidence"],
        "pathogenic_score": r["pathogenic_score"],
        "dpsic": r["dpsic"],
    } for r in results]
    return jsonify({"results": cleaned})


if __name__ == "__main__":
    port = int(os.environ.get("PORT", "8080"))
    app.run(host="0.0.0.0", port=port, debug=False)
