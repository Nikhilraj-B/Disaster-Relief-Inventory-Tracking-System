"""Generates the synthetic academic dataset for the Disaster Relief ML model.

Features follow the ML design doc:
  requested_qty, item_category, camp_population, camp_capacity,
  current_inventory, historical_freq

The dataset is synthetic. The model is trained and evaluated on synthetic data. 
The reported performance represents performance on this synthetic dataset for prototype/academic evaluation. 
Real-world validation would require historical disaster-relief request data.
"""
import numpy as np
import pandas as pd

RNG_SEED = 42
N_SAMPLES = 7500

def generate_dataset(n: int = N_SAMPLES, seed: int = RNG_SEED) -> pd.DataFrame:
    rng = np.random.default_rng(seed)

    categories = ["Food", "Medicine", "Water", "Equipment", "Shelter", "Clothing"]

    camp_population = rng.integers(200, 3000, size=n)
    # Capacity is usually slightly above population, but sometimes overcrowding happens
    camp_capacity = camp_population + rng.integers(-200, 1000, size=n)
    camp_capacity = np.maximum(camp_capacity, 100)

    item_category = rng.choice(categories, size=n)
    historical_freq = rng.integers(0, 20, size=n)

    current_inventory = rng.uniform(0, 1500, size=n)

    # Typical quantity scales with camp population.
    base_per_capita = rng.uniform(0.01, 0.15, size=n)
    
    # Medicine usually requested in smaller quantities than water
    cat_multiplier = np.ones(n)
    cat_multiplier[item_category == "Medicine"] = 0.5
    cat_multiplier[item_category == "Water"] = 2.0
    
    requested_qty = camp_population * base_per_capita * cat_multiplier
    requested_qty += rng.normal(0, 30, size=n)
    requested_qty = np.maximum(requested_qty, 1.0)

    # --- Anomaly Generation ---
    # We create a latent anomaly score based on interacting factors.
    # The anomaly_score and anomaly_probability are used ONLY to generate the label
    # and will NOT be included in the final dataset to prevent target leakage.
    
    # 1. Demand spike
    expected_qty = camp_population * 0.05 * cat_multiplier
    demand_ratio = requested_qty / np.maximum(expected_qty, 1.0)
    
    # 2. Inventory pressure
    inventory_pressure = requested_qty / np.maximum(current_inventory, 1.0)
    
    # 3. Capacity utilization
    capacity_util = camp_population / np.maximum(camp_capacity, 1.0)
    
    # 4. Frequency factor
    freq_factor = historical_freq / 20.0
    
    # Calculate latent score based on interacting weights
    latent_score = (
        1.5 * (demand_ratio - 1.5) + 
        0.8 * (inventory_pressure - 0.5) + 
        1.0 * (capacity_util - 0.9) + 
        2.0 * (freq_factor - 0.4)
    )
    
    # Add random noise to create borderline/ambiguous cases
    latent_score += rng.normal(0, 1.5, size=n)
    
    # Convert to probability using sigmoid
    anomaly_probability = 1 / (1 + np.exp(-latent_score))
    
    # Sample Bernoulli distribution to get final target
    is_abnormal = rng.binomial(1, anomaly_probability)
    
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
    
    # Quality Report
    print("="*50)
    print("DATASET QUALITY REPORT")
    print("="*50)
    print(f"Total Rows: {len(df)}")
    print(f"Total Columns: {len(df.columns)}")
    print(f"Features: {list(df.columns)}")
    print(f"Missing Values: {df.isnull().sum().sum()}")
    print(f"Duplicate Rows: {df.duplicated().sum()}")
    
    counts = df["is_abnormal"].value_counts()
    normal_count = counts.get(0, 0)
    abnormal_count = counts.get(1, 0)
    print("\nClass Distribution:")
    print(f"NORMAL (0):   {normal_count} ({normal_count/len(df)*100:.1f}%)")
    print(f"ABNORMAL (1): {abnormal_count} ({abnormal_count/len(df)*100:.1f}%)")
    
    print("\nNumeric Feature Stats (min / mean / max):")
    for col in ["requested_qty", "camp_population", "camp_capacity", "current_inventory", "historical_freq"]:
        print(f"  {col}: {df[col].min():.2f} / {df[col].mean():.2f} / {df[col].max():.2f}")
        
    print("\nUnique Categories:")
    print(list(df["item_category"].unique()))
