"""Trains the ML classifiers and saves the best pipeline to model.joblib.

The dataset is synthetic. The model is trained and evaluated on synthetic data.
The reported performance represents performance on this synthetic dataset for prototype/academic evaluation.
Real-world validation would require historical disaster-relief request data.
"""
import joblib
import pandas as pd
import numpy as np
from sklearn.compose import ColumnTransformer
from sklearn.dummy import DummyClassifier
from sklearn.linear_model import LogisticRegression
from sklearn.tree import DecisionTreeClassifier
from sklearn.ensemble import RandomForestClassifier
from sklearn.metrics import accuracy_score, classification_report, confusion_matrix, precision_score, recall_score, f1_score
from sklearn.model_selection import train_test_split, StratifiedKFold, cross_validate
from sklearn.pipeline import Pipeline
from sklearn.preprocessing import OneHotEncoder, StandardScaler
from feature_engineering import FeatureEngineer

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
# Derived features from FeatureEngineer:
DERIVED_FEATURES = [
    "requested_per_person",
    "request_to_inventory_ratio",
    "capacity_utilization",
    "frequency_to_population_ratio",
    "inventory_per_person"
]
TARGET = "is_abnormal"

def print_metrics(y_true, y_pred, model_name, dataset_name):
    acc = accuracy_score(y_true, y_pred)
    prec_abnormal = precision_score(y_true, y_pred, pos_label=1, zero_division=0)
    rec_abnormal = recall_score(y_true, y_pred, pos_label=1, zero_division=0)
    f1_abnormal = f1_score(y_true, y_pred, pos_label=1, zero_division=0)
    cm = confusion_matrix(y_true, y_pred)
    tn, fp, fn, tp = cm.ravel()
    
    print(f"\n--- {model_name} on {dataset_name} ---")
    print(f"Accuracy:          {acc:.4f}")
    print(f"ABNORMAL Precision:{prec_abnormal:.4f}")
    print(f"ABNORMAL Recall:   {rec_abnormal:.4f}")
    print(f"ABNORMAL F1:       {f1_abnormal:.4f}")
    print("Confusion Matrix:")
    print(f"  TN: {tn}  FP: {fp}")
    print(f"  FN: {fn}  TP: {tp}")
    print("---------------------------------------")
    return acc, f1_abnormal

def check_leakage(df):
    print("\n--- Data Leakage Diagnostics ---")
    print("Checking correlations with the target on the training set...")
    num_df = df.select_dtypes(include=[np.number])
    correlations = num_df.corr()[TARGET].sort_values(ascending=False)
    for col, corr in correlations.items():
        print(f"  {col}: {corr:.3f}")
    
    suspicious = correlations[(correlations > 0.9) | (correlations < -0.9)]
    suspicious = suspicious.drop(TARGET, errors='ignore')
    if len(suspicious) > 0:
        print("WARNING: Suspiciously high correlations detected:")
        print(suspicious)
    else:
        print("No suspiciously high linear correlations detected (>0.9).")
    
    print("\nTarget distribution by item_category:")
    print(df.groupby("item_category")[TARGET].mean())

def main():
    print("Loading dataset...")
    df = pd.read_csv("dataset.csv")

    X = df[CATEGORICAL_FEATURES + NUMERIC_FEATURES]
    y = df[TARGET]

    # Split: 70% Train, 15% Validation, 15% Final Test
    X_train_full, X_temp, y_train_full, y_temp = train_test_split(
        X, y, test_size=0.30, random_state=RNG_SEED, stratify=y
    )
    X_val, X_test, y_val, y_test = train_test_split(
        X_temp, y_temp, test_size=0.50, random_state=RNG_SEED, stratify=y_temp
    )
    
    print(f"Train size: {len(X_train_full)}")
    print(f"Val size:   {len(X_val)}")
    print(f"Test size:  {len(X_test)}")
    
    # Leakage check on training data
    train_df = pd.concat([X_train_full, y_train_full], axis=1)
    fe = FeatureEngineer()
    train_df_fe = fe.transform(train_df)
    check_leakage(train_df_fe)

    all_numeric_features = NUMERIC_FEATURES + DERIVED_FEATURES

    preprocessor = ColumnTransformer(
        transformers=[
            ("cat", OneHotEncoder(handle_unknown="ignore"), CATEGORICAL_FEATURES),
            ("num", StandardScaler(), all_numeric_features),
        ]
    )

    models = {
        "Baseline (Dummy)": DummyClassifier(strategy="prior"),
        "Logistic Regression": LogisticRegression(random_state=RNG_SEED, max_iter=1000, class_weight="balanced"),
        "Decision Tree": DecisionTreeClassifier(random_state=RNG_SEED, class_weight="balanced", max_depth=10),
        "Random Forest": RandomForestClassifier(n_estimators=200, max_depth=14, class_weight="balanced", random_state=RNG_SEED, n_jobs=-1)
    }

    # Cross-Validation on Training set
    print("\n--- 5-Fold Stratified CV on TRAINING SET ---")
    cv = StratifiedKFold(n_splits=5, shuffle=True, random_state=RNG_SEED)
    
    for name, clf in models.items():
        pipeline = Pipeline([
            ("feature_engineer", FeatureEngineer()),
            ("preprocessor", preprocessor),
            ("classifier", clf)
        ])
        
        scores = cross_validate(pipeline, X_train_full, y_train_full, cv=cv, 
                                scoring=['accuracy', 'f1', 'recall'], n_jobs=-1)
        print(f"\n{name}:")
        print(f"  Mean CV Accuracy:  {scores['test_accuracy'].mean():.4f} +/- {scores['test_accuracy'].std():.4f}")
        print(f"  Mean CV F1:        {scores['test_f1'].mean():.4f}")
        print(f"  Mean ABNORMAL Rec: {scores['test_recall'].mean():.4f}")

    # Validation Set Evaluation
    print("\n==================================================")
    print("VALIDATION SET EVALUATION")
    print("==================================================")
    best_model_name = None
    best_pipeline = None
    best_val_f1 = -1
    
    for name, clf in models.items():
        pipeline = Pipeline([
            ("feature_engineer", FeatureEngineer()),
            ("preprocessor", preprocessor),
            ("classifier", clf)
        ])
        pipeline.fit(X_train_full, y_train_full)
        y_val_pred = pipeline.predict(X_val)
        acc, f1 = print_metrics(y_val, y_val_pred, name, "Validation Set")
        
        if f1 > best_val_f1:
            best_val_f1 = f1
            best_model_name = name
            best_pipeline = pipeline

    print(f"\n=> Selected final model based on Validation ABNORMAL F1: {best_model_name}")

    # Final Test Set Evaluation
    print("\n==================================================")
    print("FINAL TEST SET EVALUATION")
    print("==================================================")
    y_test_pred = best_pipeline.predict(X_test)
    print_metrics(y_test, y_test_pred, best_model_name, "FINAL TEST SET")
    
    # Feature Importance for Random Forest
    if best_model_name == "Random Forest":
        print("\n--- Feature Importances ---")
        classifier = best_pipeline.named_steps['classifier']
        prep = best_pipeline.named_steps['preprocessor']
        
        cat_features = prep.named_transformers_['cat'].get_feature_names_out(CATEGORICAL_FEATURES)
        feature_names = list(cat_features) + all_numeric_features
        
        importances = classifier.feature_importances_
        indices = np.argsort(importances)[::-1]
        
        for i in range(min(15, len(importances))):
            print(f"{i+1}. {feature_names[indices[i]]}: {importances[indices[i]]:.4f}")

    # Save Model
    joblib.dump(best_pipeline, MODEL_PATH)
    print(f"\nSaved best pipeline ({best_model_name}) -> {MODEL_PATH}")

if __name__ == "__main__":
    main()
