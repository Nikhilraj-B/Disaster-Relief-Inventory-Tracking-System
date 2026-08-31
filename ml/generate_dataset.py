"""Generates the synthetic academic dataset for the Disaster Relief ML model.

Features follow the ML design doc:
  requested_qty, item_category, camp_population, camp_capacity,
  current_inventory, historical_freq  ->  is_abnormal (0=NORMAL, 1=ABNORMAL)

A request is considered anomalous when it deviates from expected camp patterns,
e.g. a very large requested quantity relative to camp population/inventory, or
an unexpectedly high frequency for the same item.
"""
import numpy as np
import pandas as pd

RNG_SEED = 42
N_SAMPLES = 3000


def generate_dataset(n: int = N_SAMPLES, seed: int = RNG_SEED) -> pd.DataFrame:
    rng = np.random.default_rng(seed)

    categories = ["Food", "Medicine", "Water", "Equipment", "Shelter", "Clothing"]

    camp_population = rng.integers(200, 3000, size=n)
    camp_capacity = camp_population + rng.integers(100, 1200, size=n)
    item_category = rng.choice(categories, size=n)
    historical_freq = rng.integers(0, 20, size=n)

    requested_qty = np.zeros(n, dtype=float)
    current_inventory = rng.uniform(0, 1500, size=n)

    # Typical quantity scales with camp population.
    base_per_capita = rng.uniform(0.01, 0.15, size=n)
    requested_qty = camp_population * base_per_capita
    # Some natural noise around inventory availability.
    requested_qty += rng.normal(0, 30, size=n)
    requested_qty = np.maximum(requested_qty, 1.0)

    # Ground-truth anomaly rule: a request is abnormal if it is far above the
    # population-scaled expectation AND inventory is low, or frequency is extreme.
    expected = camp_population * 0.05
    ratio = requested_qty / np.maximum(expected, 1e-9)
    low_inventory = current_inventory < camp_population * 0.02
    high_frequency = historical_freq >= 12

    is_abnormal = ((ratio > 3.0) & low_inventory) | high_frequency
    is_abnormal = is_abnormal.astype(int)

    # Inject some label noise to make the task realistically learnable.
    flip = rng.random(n) < 0.04
    is_abnormal = np.where(flip, 1 - is_abnormal, is_abnormal)

    df = pd.DataFrame({
        "requested_qty": np.round(requested_qty, 2),
        "item_category": item_category,
        "camp_population": camp_population,
        "camp_capacity": camp_capacity,
        "current_inventory": np.round(current_inventory, 2),
        "historical_freq": historical_freq,
        "is_abnormal": is_abnormal,
    })
    return df


if __name__ == "__main__":
    df = generate_dataset()
    df.to_csv("dataset.csv", index=False)
    print(f"Generated {len(df)} rows -> dataset.csv")
    print(df.head())
    print("Label distribution:")
    print(df["is_abnormal"].value_counts())
