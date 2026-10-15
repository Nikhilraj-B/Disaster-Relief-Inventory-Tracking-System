from sklearn.base import BaseEstimator, TransformerMixin
import numpy as np

class FeatureEngineer(BaseEstimator, TransformerMixin):
    """
    Custom transformer to engineer meaningful domain features from the original 6 raw inputs.
    Must be imported in main.py for joblib to successfully load the pipeline.
    """
    def fit(self, X, y=None):
        return self
        
    def transform(self, X, y=None):
        # Ensure X is a copy to avoid SettingWithCopyWarning
        X_out = X.copy()
        
        # 1. requested_per_person: How much of an item is requested per individual
        X_out['requested_per_person'] = X_out['requested_qty'] / np.maximum(X_out['camp_population'], 1)
        
        # 2. request_to_inventory_ratio: How much is requested relative to what we already have
        X_out['request_to_inventory_ratio'] = X_out['requested_qty'] / np.maximum(X_out['current_inventory'], 1)
        
        # 3. capacity_utilization: Are we over capacity?
        X_out['capacity_utilization'] = X_out['camp_population'] / np.maximum(X_out['camp_capacity'], 1)
        
        # 4. frequency_to_population_ratio
        X_out['frequency_to_population_ratio'] = X_out['historical_freq'] / np.maximum(X_out['camp_population'], 1)
        
        # 5. inventory_per_person: Do they already have enough stock per person?
        X_out['inventory_per_person'] = X_out['current_inventory'] / np.maximum(X_out['camp_population'], 1)
        
        return X_out
