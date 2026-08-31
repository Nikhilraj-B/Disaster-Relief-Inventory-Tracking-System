from fastapi import FastAPI, HTTPException
from pydantic import BaseModel, Field
import joblib
import os

MODEL_PATH = os.getenv("MODEL_PATH", "model.joblib")

app = FastAPI(title="Disaster Relief ML Service")

try:
    model = joblib.load(MODEL_PATH)
    app.state.model = model
    app.state.model_loaded = True
    print(f"Loaded model from {MODEL_PATH}")
except Exception as exc:  # pragma: no cover
    app.state.model = None
    app.state.model_loaded = False
    print(f"WARNING: could not load model: {exc}. Predictions will fail until retrained.")


class SupplyRequestFeatures(BaseModel):
    requested_qty: float = Field(..., gt=0)
    item_category: str
    camp_population: int = Field(..., ge=0)
    camp_capacity: int = Field(..., ge=0)
    current_inventory: float = Field(..., ge=0)
    historical_freq: int = Field(..., ge=0)


class PredictionResponse(BaseModel):
    classification: str  # NORMAL | ABNORMAL
    confidence: float


@app.get("/")
def read_root():
    return {
        "status": "ML Service is running",
        "model_loaded": app.state.model_loaded,
    }


@app.post("/predict", response_model=PredictionResponse)
def predict(features: SupplyRequestFeatures):
    if not app.state.model_loaded:
        raise HTTPException(status_code=500, detail="Model not loaded")

    try:
        row = [{
            "requested_qty": features.requested_qty,
            "item_category": features.item_category,
            "camp_population": features.camp_population,
            "camp_capacity": features.camp_capacity,
            "current_inventory": features.current_inventory,
            "historical_freq": features.historical_freq,
        }]
        import pandas as pd
        frame = pd.DataFrame(row)
        proba = app.state.model.predict_proba(frame)[0]
        classes = app.state.model.classes_
        idx = int(proba.argmax())
        predicted_class = int(classes[idx])
        confidence = float(proba[idx])
        classification = "ABNORMAL" if predicted_class == 1 else "NORMAL"
        return PredictionResponse(classification=classification, confidence=confidence)
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Inference failed: {exc}")
