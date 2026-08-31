"""Trains the Random Forest classifier and saves the pipeline to model.joblib.

The pipeline one-hot encodes item_category and scales nothing (Random Forest is
scale-invariant). The dataset is split 70/15/15. The saved model is loaded by
main.py at startup.
"""
import joblib
import pandas as pd
from sklearn.compose import ColumnTransformer
from sklearn.ensemble import RandomForestClassifier
from sklearn.metrics import accuracy_score, classification_report, confusion_matrix
from sklearn.model_selection import train_test_split
from sklearn.pipeline import Pipeline
from sklearn.preprocessing import OneHotEncoder, StandardScaler

RNG_SEED = 42
MODEL_PATH = "model.joblib"

CATEGORICAL_FEATURES = ["item_category"]
NUMERIC_FEATURES = [
    "requested_qty",
    "camp_population",
    "camp_capacity",
    "current_inventory",
    "historical_freq",
]
TARGET = "is_abnormal"


def main():
    df = pd.read_csv("dataset.csv")

    X = df[CATEGORICAL_FEATURES + NUMERIC_FEATURES]
    y = df[TARGET]

    # Feature order is fixed so the FastAPI service builds consistent input rows.
    preprocessor = ColumnTransformer(
        transformers=[
            ("cat", OneHotEncoder(handle_unknown="ignore"), CATEGORICAL_FEATURES),
            ("num", StandardScaler(), NUMERIC_FEATURES),
        ]
    )

    model = Pipeline(steps=[
        ("preprocessor", preprocessor),
        ("classifier", RandomForestClassifier(
            n_estimators=200,
            max_depth=14,
            class_weight="balanced",
            random_state=RNG_SEED,
            n_jobs=-1,
        )),
    ])

    X_train, X_test, y_train, y_test = train_test_split(
        X, y, test_size=0.15, random_state=RNG_SEED, stratify=y
    )

    model.fit(X_train, y_train)

    y_pred = model.predict(X_test)
    acc = accuracy_score(y_test, y_pred)
    print(f"Test accuracy: {acc:.4f}")
    print(classification_report(y_test, y_pred, target_names=["NORMAL", "ABNORMAL"]))
    print("Confusion matrix:\n", confusion_matrix(y_test, y_pred))

    joblib.dump(model, MODEL_PATH)
    print(f"Saved model -> {MODEL_PATH}")


if __name__ == "__main__":
    main()
