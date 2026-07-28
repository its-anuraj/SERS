"""
SERS ML Model Training Pipeline
Generates synthetic dataset of 5,000 emergency records, trains Scikit-Learn RandomForest + GradientBoosting models,
evaluates performance metrics, and serializes trained .joblib artifacts for FastAPI inference.
"""

import os
import math
import random
import numpy as np  # type: ignore # pyright: ignore # noqa
import pandas as pd  # type: ignore # pyright: ignore # noqa
from sklearn.ensemble import RandomForestClassifier, GradientBoostingRegressor  # type: ignore # pyright: ignore # noqa
from sklearn.model_selection import train_test_split  # type: ignore # pyright: ignore # noqa
from sklearn.metrics import accuracy_score, mean_squared_error  # type: ignore # pyright: ignore # noqa
import joblib  # type: ignore # pyright: ignore # noqa



MODELS_DIR = os.path.join(os.path.dirname(__file__), 'models')
os.makedirs(MODELS_DIR, exist_ok=True)

print("🚀 Starting SERS ML Dataset Generation & Model Training Pipeline...")

# ============================================================
# 1. Dataset Generation: Crash Sensor & Telemetry Data (5,000 samples)
# ============================================================
np.random.seed(42)
random.seed(42)

N_SAMPLES = 5000

accel_max = np.random.uniform(5.0, 50.0, N_SAMPLES)      # m/s²
speed_initial = np.random.uniform(0.0, 120.0, N_SAMPLES) # km/h
speed_drop = np.clip(speed_initial - np.random.uniform(0.0, 30.0, N_SAMPLES), 0, None)
gyro_rotation = np.random.uniform(10.0, 450.0, N_SAMPLES)# deg/s
duration_ms = np.random.uniform(20.0, 1500.0, N_SAMPLES) # impact duration ms

# Label logic: 0 = Minor/No Crash, 1 = Moderate Crash, 2 = Critical Crash / Rollover
labels = []
for i in range(N_SAMPLES):
    m = accel_max[i]
    sd = speed_drop[i]
    rot = gyro_rotation[i]
    dur = duration_ms[i]
    
    if (m > 30.0 and sd > 25.0) or rot > 250.0:
        labels.append(2) # Critical
    elif (m > 20.0 and sd > 15.0) or (m > 25.0 and dur > 100):
        labels.append(1) # Moderate
    elif m > 22.0 and speed_initial < 5.0 and rot < 80.0:
        labels.append(0) # Phone drop filtered
    else:
        labels.append(0) # Minor / No Crash

df_crash = pd.DataFrame({
    'accel_max': accel_max,
    'speed_initial': speed_initial,
    'speed_drop': speed_drop,
    'gyro_rotation': gyro_rotation,
    'duration_ms': duration_ms,
    'is_crash_severity': labels
})

X_crash = df_crash[['accel_max', 'speed_initial', 'speed_drop', 'gyro_rotation', 'duration_ms']]
y_crash = df_crash['is_crash_severity']

X_train_c, X_test_c, y_train_c, y_test_c = train_test_split(X_crash, y_crash, test_size=0.2, random_state=42)

print("\n--- Training Crash Telemetry Classifier (RandomForest) ---")
clf_crash = RandomForestClassifier(n_estimators=100, max_depth=10, random_state=42)
clf_crash.fit(X_train_c, y_train_c)

y_pred_c = clf_crash.predict(X_test_c)
acc_c = accuracy_score(y_test_c, y_pred_c)
print(f"✅ Crash Detection Accuracy: {acc_c * 100:.2f}%")

crash_model_path = os.path.join(MODELS_DIR, 'crash_model.joblib')
joblib.dump(clf_crash, crash_model_path)
print(f"📦 Saved model artifact: {crash_model_path}")

# ============================================================
# 2. Dataset Generation: Image & Triage Severity Classifier
# ============================================================
damage_level = np.random.uniform(1.0, 10.0, N_SAMPLES)
airbag = np.random.binomial(1, p=np.clip(damage_level / 12.0, 0.1, 0.9), size=N_SAMPLES)
glass = np.random.binomial(1, p=np.clip(damage_level / 10.0, 0.2, 0.95), size=N_SAMPLES)
fire = np.random.binomial(1, p=np.clip(damage_level / 15.0, 0.05, 0.4), size=N_SAMPLES)

severity_score = np.clip(
    damage_level * 0.6 + airbag * 1.5 + glass * 1.0 + fire * 2.5 + np.random.normal(0, 0.5, N_SAMPLES),
    1.0, 10.0
)

severity_label = np.where(severity_score >= 7.0, 2, np.where(severity_score >= 4.0, 1, 0))

df_sev = pd.DataFrame({
    'damage_level': damage_level,
    'airbag_deployed': airbag,
    'glass_shatter': glass,
    'smoke_fire': fire,
    'severity_score': severity_score,
    'severity_label': severity_label
})

X_sev = df_sev[['damage_level', 'airbag_deployed', 'glass_shatter', 'smoke_fire']]
y_sev = df_sev['severity_label']

X_train_s, X_test_s, y_train_s, y_test_s = train_test_split(X_sev, y_sev, test_size=0.2, random_state=42)

print("\n--- Training Incident Severity Classifier (RandomForest) ---")
clf_sev = RandomForestClassifier(n_estimators=100, random_state=42)
clf_sev.fit(X_train_s, y_train_s)

acc_s = accuracy_score(y_test_s, clf_sev.predict(X_test_s))
print(f"✅ Severity Classification Accuracy: {acc_s * 100:.2f}%")

sev_model_path = os.path.join(MODELS_DIR, 'severity_model.joblib')
joblib.dump(clf_sev, sev_model_path)
print(f"📦 Saved model artifact: {sev_model_path}")

# ============================================================
# 3. Dataset Generation: Smart Hospital Matcher (Gradient Boosting Regressor)
# ============================================================
distance_km = np.random.uniform(0.5, 25.0, N_SAMPLES)
icu_beds = np.random.randint(0, 20, N_SAMPLES)
er_beds = np.random.randint(0, 30, N_SAMPLES)
specialty_match = np.random.uniform(0.0, 1.0, N_SAMPLES)
trauma_center = np.random.binomial(1, 0.4, N_SAMPLES)

match_score = (
    (100 - distance_km * 3) * 0.4 +
    (icu_beds * 3 + er_beds * 2) * 0.3 +
    (specialty_match * 100) * 0.2 +
    (trauma_center * 20) * 0.1
)

df_hosp = pd.DataFrame({
    'distance_km': distance_km,
    'icu_beds': icu_beds,
    'er_beds': er_beds,
    'specialty_match': specialty_match,
    'trauma_center': trauma_center,
    'match_score': match_score
})

X_hosp = df_hosp[['distance_km', 'icu_beds', 'er_beds', 'specialty_match', 'trauma_center']]
y_hosp = df_hosp['match_score']

X_train_h, X_test_h, y_train_h, y_test_h = train_test_split(X_hosp, y_hosp, test_size=0.2, random_state=42)

print("\n--- Training Smart Hospital Matcher (GradientBoostingRegressor) ---")
reg_hosp = GradientBoostingRegressor(n_estimators=100, random_state=42)
reg_hosp.fit(X_train_h, y_train_h)

mse_h = mean_squared_error(y_test_h, reg_hosp.predict(X_test_h))
print(f"✅ Hospital Matcher RMSE: {math.sqrt(mse_h):.4f}")

hosp_model_path = os.path.join(MODELS_DIR, 'hospital_matcher.joblib')
joblib.dump(reg_hosp, hosp_model_path)
print(f"📦 Saved model artifact: {hosp_model_path}")

print("\n🎉 All SERS Machine Learning Models Trained & Serialized Successfully!")
