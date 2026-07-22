import pandas as pd
import numpy as np
import os
import json
import joblib
from sklearn.tree import DecisionTreeClassifier
from sklearn.model_selection import train_test_split
from sklearn.metrics import accuracy_score, classification_report
from typing import Dict, List, Any

# Setup paths
BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DATA_PATH = os.path.join(BASE_DIR, "data", "comprehensive_foods_usda.csv")
MODEL_FILE = os.path.join(BASE_DIR, "ml", "models", "diet_quality_model.joblib")
METRIC_FILE = os.path.join(BASE_DIR, "ml", "models", "diet_quality_metrics.json")

# Global variables for caching
_FOOD_DATA = None
_ML_MODEL = None

def load_data():
    "Load and preprocess the USDA dataset."
    global _FOOD_DATA
    if _FOOD_DATA is not None:
        return _FOOD_DATA

    df = pd.read_csv(DATA_PATH, low_memory=False)
    
    # Basic cleaning
    cols_to_fix = ['calories', 'protein_g', 'carbs_g', 'fat_g', 'sugar_g', 'sodium_mg', 'fiber_g', 'health_score', 'saturated_fat_g']
    for col in cols_to_fix:
        df[col] = pd.to_numeric(df[col], errors='coerce').fillna(0)
    
    # Detect and fix kJ vs kcal (kJ is usually > 3.5x expected kcal)
    expected_kcal = (df['carbs_g'] * 4 + df['fat_g'] * 9 + df['protein_g'] * 4)
    df['calories'] = np.where(
        (df['calories'] > expected_kcal * 3.5) & (expected_kcal > 10),
        df['calories'] / 4.184,
        df['calories']
    )
    
    _FOOD_DATA = df
    return _FOOD_DATA


def _clean_metrics_for_json(metrics: dict) -> dict:
    if isinstance(metrics, dict):
        return {k: _clean_metrics_for_json(v) for k, v in metrics.items()}
    if isinstance(metrics, list):
        return [_clean_metrics_for_json(v) for v in metrics]
    if isinstance(metrics, np.generic):
        return metrics.item()
    return metrics


def _get_quality_class(score: Any) -> int:
    try:
        score = float(score)
    except (TypeError, ValueError):
        return 1
    if score < 40:
        return 0
    if score < 60:
        return 1
    if score < 80:
        return 2
    return 3


def _save_model(model):
    os.makedirs(os.path.dirname(MODEL_FILE), exist_ok=True)
    joblib.dump(model, MODEL_FILE)


def _load_saved_model():
    global _ML_MODEL
    if _ML_MODEL is not None:
        return _ML_MODEL
    if os.path.exists(MODEL_FILE):
        try:
            _ML_MODEL = joblib.load(MODEL_FILE)
            return _ML_MODEL
        except Exception:
            pass
    return None


def _evaluate_model(model, X_test, y_test) -> dict:
    predictions = model.predict(X_test)
    report = classification_report(y_test, predictions, output_dict=True, zero_division=0)
    return {
        "accuracy": float(accuracy_score(y_test, predictions)),
        "classification_report": report,
    }


def train_model(df):
    "Train a Decision Tree model to rank food quality."
    global _ML_MODEL
    if _ML_MODEL is not None:
        return _ML_MODEL

    loaded = _load_saved_model()
    if loaded is not None:
        return loaded

    features = ['calories', 'protein_g', 'carbs_g', 'fat_g', 'sugar_g', 'sodium_mg', 'fiber_g']
    df = df.copy()
    df[features] = df[features].apply(pd.to_numeric, errors='coerce').fillna(0)

    y = df['health_score'].apply(_get_quality_class)
    X = df[features]

    try:
        X_train, X_test, y_train, y_test = train_test_split(
            X,
            y,
            test_size=0.2,
            random_state=42,
            stratify=y,
        )
    except ValueError:
        X_train, X_test, y_train, y_test = train_test_split(
            X,
            y,
            test_size=0.2,
            random_state=42,
        )

    _ML_MODEL = DecisionTreeClassifier(max_depth=5, random_state=42)
    _ML_MODEL.fit(X_train, y_train)
    _save_model(_ML_MODEL)

    metrics = _evaluate_model(_ML_MODEL, X_test, y_test)
    try:
        os.makedirs(os.path.dirname(METRIC_FILE), exist_ok=True)
        with open(METRIC_FILE, 'w', encoding='utf-8') as f:
            json.dump(_clean_metrics_for_json(metrics), f, indent=2)
    except Exception:
        pass

    print("[Diet Recommendation] Trained model accuracy:", metrics["accuracy"])
    return _ML_MODEL

def apply_rules(df, user_profile):
    "Mandatory rule-based filtering for safety and dietary compliance."
    filtered = df.copy()
    
    # 1. Allergies (Hard Exclude)
    allergies = user_profile.get('allergies', 'none')
    if isinstance(allergies, str): 
        if allergies.lower() == 'none': allergies = []
        else: allergies = [a.strip() for a in allergies.split(',')]
    
    for allergy in allergies:
        if not allergy: continue
        pattern = allergy.lower()
        filtered = filtered[~filtered['food_name'].str.contains(pattern, case=False, na=False)]
        if 'ingredients' in filtered.columns:
            filtered = filtered[~filtered['ingredients'].str.contains(pattern, case=False, na=False)]
    
    # 2. Health Conditions
    conditions = user_profile.get('healthCondition', 'none')
    if isinstance(conditions, str):
        if conditions.lower() == 'none': conditions = []
        else: conditions = [c.strip().lower() for c in conditions.split(',')]
    
    if 'diabetes' in conditions:
        filtered = filtered[filtered['sugar_g'] < 5] # Strict sugar limit
    if 'hypertension' in conditions:
        filtered = filtered[filtered['sodium_mg'] < 300] # Strict sodium limit
    if 'cholesterol' in conditions or 'cholestrol' in conditions:
        filtered = filtered[filtered['saturated_fat_g'] < 2]
    if 'thyroid' in conditions:
        # Avoid goitrogens (soy, cruciferous vegetables raw - though dataset is limited)
        filtered = filtered[~filtered['food_name'].str.contains('soy|tofu|edamame', case=False, na=False)]
        
    # 3. Diet Type
    diet = user_profile.get('dietaryPreference', 'none').lower()
    meat_cats = ['Beef Products', 'Pork Products', 'Poultry Products', 'Sausages and Luncheon Meats', 'Finfish and Shellfish Products', 'Lamb, Veal, and Game Products']
    
    if 'vegan' in diet:
        filtered = filtered[~filtered['food_category'].isin(meat_cats + ['Dairy and Egg Products'])]
        filtered = filtered[~filtered['food_name'].str.contains('milk|egg|cheese|honey|meat|chicken|fish|beef|pork|lamb|veal', case=False, na=False)]
    elif 'vegetarian' in diet:
        filtered = filtered[~filtered['food_category'].isin(meat_cats)]
        filtered = filtered[~filtered['food_name'].str.contains('meat|chicken|fish|beef|pork|lamb|veal', case=False, na=False)]
    
    # 4. Fitness Goal Specific Filtering
    goal = user_profile.get('fitnessGoal', 'maintain').lower()
    if 'lose' in goal:
        filtered = filtered[filtered['calories'] < 500] 
        filtered = filtered[filtered['sugar_g'] < 10]
    elif 'build' in goal or 'muscle' in goal:
        filtered = filtered[filtered['protein_g'] > 3] 
        
    return filtered

def select_meals(df, total_calories, target_macros, fitness_goal):
    "Build meal sets with more realistic multi-item composition while preserving safety and ranking." 

    ratios = {"breakfast": 0.25, "lunch": 0.30, "dinner": 0.30, "snacks": 0.15}
    cats = {
        "breakfast": ['Fruits and Fruit Juices', 'Breakfast Cereals', 'Dairy and Egg Products', 'Baked Products'],
        "lunch": ['Vegetables and Vegetable Products', 'Grains and Pasta', 'Legumes and Legume Products', 'Beef Products', 'Pork Products', 'Poultry Products', 'Finfish and Shellfish Products', 'Meals, Entrees, and Side Dishes'],
        "dinner": ['Vegetables and Vegetable Products', 'Grains and Pasta', 'Legumes and Legume Products', 'Beef Products', 'Pork Products', 'Poultry Products', 'Finfish and Shellfish Products', 'Meals, Entrees, and Side Dishes'],
        "snacks": ['Nut and Seed Products', 'Fruits and Fruit Juices', 'Snacks', 'Sweets'],
    }

    exclude = 'dry|powder|raw|unprepared|freeze-dried|dehydrated|spice|herb|liquid|supplement|oil|syrup'
    pool = df[~df['food_name'].str.contains(exclude, case=False, na=False)].copy()
    pool = pool[pool['food_category'] != 'Spices and Herbs']
    pool = pool[pool['calories'] > 10]

    selected_names = set()
    plan = {}

    for meal_type, ratio in ratios.items():
        meal_target_cal = total_calories * ratio
        meal_target_prot = target_macros['protein'] * ratio

        meal_pool = pool[pool['food_category'].isin(cats[meal_type])].copy()
        if meal_type in ['lunch', 'dinner']:
            meal_pool = meal_pool[meal_pool['calories'] > 80]
        elif meal_type == 'snacks':
            meal_pool = meal_pool[meal_pool['calories'] < 300]

        meal_pool = meal_pool[~meal_pool['food_name'].isin(selected_names)].copy()
        if meal_pool.empty:
            meal_pool = pool[~pool['food_name'].isin(selected_names)].copy()
        if meal_pool.empty:
            meal_pool = pool.copy()
        if meal_pool.empty:
            return get_default_plan(df, total_calories, target_macros)

        cal_diff = (meal_pool['calories'] - meal_target_cal).abs()
        prot_diff = (meal_pool['protein_g'] - meal_target_prot).abs()
        meal_pool['final_score'] = (
            - cal_diff * 0.5
            - prot_diff * 0.2
            + meal_pool['health_score'] * 0.2
            + meal_pool['ml_rank'] * 0.1
        )
        meal_pool = meal_pool.sort_values('final_score', ascending=False)

        chosen_items = []
        primary = meal_pool.iloc[0]
        chosen_items.append(primary)
        selected_names.add(primary['food_name'])

        if meal_type in ['breakfast', 'lunch', 'dinner']:
            remaining_cal = meal_target_cal - primary['calories']
            if remaining_cal > 70 and len(meal_pool) > 1:
                secondary_candidates = meal_pool[meal_pool['food_name'] != primary['food_name']].copy()
                if not secondary_candidates.empty:
                    secondary_candidates['combo_score'] = (
                        - (secondary_candidates['calories'] - remaining_cal).abs() * 0.6
                        - (secondary_candidates['protein_g'] - max(target_macros['protein'] * 0.1, 8)).abs() * 0.2
                        + secondary_candidates['health_score'] * 0.1
                        + secondary_candidates['ml_rank'] * 0.1
                    )
                    secondary = secondary_candidates.sort_values('combo_score', ascending=False).iloc[0]
                    if secondary['calories'] > 20:
                        chosen_items.append(secondary)
                        selected_names.add(secondary['food_name'])
        else:
            if primary['calories'] < meal_target_cal * 0.6 and len(meal_pool) > 1:
                snack_candidates = meal_pool[meal_pool['food_name'] != primary['food_name']].copy()
                snack_candidates = snack_candidates[snack_candidates['calories'] < 220]
                if not snack_candidates.empty:
                    snack = snack_candidates.sort_values('final_score', ascending=False).iloc[0]
                    chosen_items.append(snack)
                    selected_names.add(snack['food_name'])

        plan[meal_type] = [
            {
                "food_name": item['food_name'],
                "calories": round(float(item['calories']), 1),
                "protein_g": round(float(item['protein_g']), 1),
                "carbs_g": round(float(item['carbs_g']), 1),
                "fat_g": round(float(item['fat_g']), 1),
            }
            for item in chosen_items
        ]

    return plan


def get_default_plan(df, total_calories, target_macros):
    "Fallback meal plan when the food pool is too small." 
    top_items = df.sort_values('health_score', ascending=False).head(4)
    if top_items.empty:
        return {"breakfast": [], "lunch": [], "dinner": [], "snacks": []}

    plan = {}
    for index, meal_type in enumerate(["breakfast", "lunch", "dinner", "snacks"]):
        item = top_items.iloc[index % len(top_items)]
        plan[meal_type] = [{
            "food_name": item['food_name'],
            "calories": round(float(item['calories']), 1),
            "protein_g": round(float(item['protein_g']), 1),
            "carbs_g": round(float(item['carbs_g']), 1),
            "fat_g": round(float(item['fat_g']), 1),
        }]
    return plan


def recommend_diet(user_profile: Dict[str, Any]) -> Dict[str, Any]:
    "Main entry point for personalized ML-powered diet recommendation."
    df = load_data()
    model = train_model(df)
    
    # 1. Calorie & Macro Calculation
    age = int(user_profile.get('age', 30))
    weight = float(user_profile.get('weight', 70))
    height = float(user_profile.get('height', 170))
    gender = user_profile.get('gender', 'male').lower()
    
    # BMR (Mifflin-St Jeor)
    bmr = (10 * weight) + (6.25 * height) - (5 * age) + (5 if gender == 'male' else -161)
    
    multipliers = {'sedentary': 1.2, 'light': 1.375, 'moderate': 1.55, 'active': 1.725, 'extreme': 1.9}
    tdee = bmr * multipliers.get(user_profile.get('activityLevel', 'moderate').lower(), 1.2)
    
    goal = user_profile.get('fitnessGoal', 'maintain').lower()
    if 'lose' in goal: calories = tdee - 500
    elif 'build' in goal or 'muscle' in goal: calories = tdee + 400
    else: calories = tdee
    
    calories = int(max(1200, calories))
    
    # Macros split
    p_g, c_g, f_g = int(calories * 0.3 / 4), int(calories * 0.4 / 4), int(calories * 0.3 / 9)
    macros = {"protein": p_g, "carbs": c_g, "fats": f_g}

    # 2. Rule-based Filtering (Personalized)
    filtered_df = apply_rules(df, user_profile)
    used_fallback = False
    if filtered_df.empty:
        filtered_df = df[df['calories'] > 20].copy()
        used_fallback = True

    # 3. ML Ranking
    features = ['calories', 'protein_g', 'carbs_g', 'fat_g', 'sugar_g', 'sodium_mg', 'fiber_g']
    filtered_df['ml_rank'] = model.predict(filtered_df[features])
    
    # 4. Meal Selection (Personalized Scoring)
    meal_plan = select_meals(filtered_df, calories, macros, goal)
    
    # 5. Explanation
    cond = user_profile.get('healthCondition', 'none')
    explanation = f"Generated a {calories} kcal plan tailored for {goal}. "
    explanation += f"Used Decision Tree ML to rank {len(filtered_df)} safe foods, prioritizing those best suited for "
    explanation += f"{cond if cond != 'none' else 'your'} health profile."
    if used_fallback:
        explanation += " Some very strict filters removed most options, so the plan was built from the closest available safe foods."

    return {
        "calories": calories,
        "macros": macros,
        "meal_plan": meal_plan,
        "explanation": explanation
    }

if __name__ == "__main__":
    # Quick Test
    sample = {
        "age": 28,
        "weight": 75,
        "height": 175,
        "gender": "male",
        "activityLevel": "active",
        "healthCondition": "diabetes",
        "allergies": "nuts",
        "dietaryPreference": "vegetarian",
        "fitnessGoal": "build muscle"
    }
    print(json.dumps(recommend_diet(sample), indent=2))
