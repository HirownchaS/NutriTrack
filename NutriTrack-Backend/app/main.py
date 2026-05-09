import io
import json
import os
import asyncio
import httpx
import joblib
import pandas as pd
from datetime import datetime
from functools import lru_cache
from fastapi import FastAPI, File, UploadFile, HTTPException, status, Body
from fastapi.middleware.cors import CORSMiddleware
from ultralytics import YOLO
from PIL import Image

from contextlib import asynccontextmanager
from .schemas import (
    DietRecommendationRequest, 
    DietRecommendationResponse
)
from .diet_recommendation_engine import recommend_diet as advanced_recommend_diet

@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup logic
    print("✅ API started successfully.")
    yield
    # Shutdown logic


app = FastAPI(title="Food Recognition API", lifespan=lifespan)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Load trained YOLOv8 food model
MODEL_PATH = os.path.join(os.path.dirname(os.path.dirname(__file__)), "models", "model.safetensors")
model = YOLO(MODEL_PATH) 

# USDA FoodData Central API
USDA_API_KEY = "j7Az440yNR0hz7b7IlJBcu7Ey7eg7MsnbfqayCcZ"
USDA_API_URL = "https://api.nal.usda.gov/fdc/v1/foods/search"

# USDA nutrient IDs
NUTRIENT_IDS = {
    "calories": 1008,
    "protein": 1003,
    "fat": 1004,
    "carbs": 1005,
    "fiber": 1079,
}

# In-memory cache for USDA results
_usda_cache: dict = {}

# Load local nutrition database as fallback
NUTRITION_DB_PATH = os.path.join(os.path.dirname(__file__), "nutrition_db.json")
try:
    with open(NUTRITION_DB_PATH, "r") as f:
        nutrition_db = json.load(f)
except Exception:
    nutrition_db = {}


def normalize_food_name(name: str) -> str:
    """Normalize food name: lowercase, replace underscores/hyphens with spaces, strip extra whitespace."""
    return name.lower().strip().replace("_", " ").replace("-", " ")


def extract_nutrient(food_data: dict, nutrient_id: int) -> float:
    """Extract a specific nutrient value from USDA food item by nutrient ID."""
    for nutrient in food_data.get("foodNutrients", []):
        if nutrient.get("nutrientId") == nutrient_id:
            return float(nutrient.get("value", 0) or 0)
    return 0.0


async def get_nutrition_usda(food_name: str) -> dict:
    """
    Fetch nutrition data from USDA FoodData Central API.
    Returns per-100g values: calories, protein, fat, carbs, fiber.
    Falls back to local DB or defaults if not found.
    """
    normalized = normalize_food_name(food_name)

    # Check cache first
    if normalized in _usda_cache:
        return _usda_cache[normalized]

    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            response = await client.get(
                USDA_API_URL,
                params={
                    "query": normalized,
                    "api_key": USDA_API_KEY,
                    "pageSize": 5,
                    "dataType": "SR Legacy,Foundation,Branded",
                },
            )
            response.raise_for_status()
            data = response.json()

        foods = data.get("foods", [])
        if foods:
            # Use first result
            first = foods[0]
            result = {
                "calories": extract_nutrient(first, NUTRIENT_IDS["calories"]),
                "protein": extract_nutrient(first, NUTRIENT_IDS["protein"]),
                "fat": extract_nutrient(first, NUTRIENT_IDS["fat"]),
                "carbs": extract_nutrient(first, NUTRIENT_IDS["carbs"]),
                "fiber": extract_nutrient(first, NUTRIENT_IDS["fiber"]),
                "source": "usda",
                "description": first.get("description", food_name),
            }
            _usda_cache[normalized] = result
            return result

    except Exception as e:
        print(f"[USDA API] Failed for '{food_name}': {e}")

    # Fallback: local DB
    for key, val in nutrition_db.items():
        if key in normalized or normalized in key:
            result = {
                "calories": val.get("calories", 150),
                "protein": val.get("protein", 5.0),
                "fat": val.get("fat", 5.0),
                "carbs": val.get("carbs", 10.0),
                "fiber": val.get("fiber", 0.0),
                "source": "local_db",
                "description": food_name,
            }
            _usda_cache[normalized] = result
            return result

    # Final fallback: generic defaults
    result = {
        "calories": 150,
        "protein": 5.0,
        "fat": 5.0,
        "carbs": 10.0,
        "fiber": 0.0,
        "source": "default",
        "description": food_name,
    }
    _usda_cache[normalized] = result
    return result


@app.get("/")
def index():
    return {"message": "Welcome to Food Recognition API"}


async def predict_food_image(image_bytes: bytes) -> dict:
    try:
        # Load image
        image = Image.open(io.BytesIO(image_bytes)).convert("RGB")
        image_area = image.width * image.height

        # Run YOLOv8 prediction
        results = model.predict(source=image, imgsz=640, conf=0.25)

        detections = []
        total_calories = 0.0
        total_protein = 0.0
        total_carbs = 0.0
        total_fat = 0.0
        total_fiber = 0.0

        # Gather unique food labels first to batch/async USDA calls efficiently
        food_labels = []
        box_data = []
        for r in results:
            for box in r.boxes:
                cls_id = int(box.cls[0])
                conf = float(box.conf[0])
                label = model.names[cls_id]
                xyxy = box.xyxy[0].tolist()
                bbox_area = (xyxy[2] - xyxy[0]) * (xyxy[3] - xyxy[1])
                portion_grams = min((bbox_area / image_area) * 500, 800)
                food_labels.append(label)
                box_data.append((label, conf, xyxy, portion_grams))

        # Fetch all USDA nutrition concurrently (1 request per unique food)
        unique_labels = list(set(food_labels))
        nutrition_tasks = {label: get_nutrition_usda(label) for label in unique_labels}
        nutrition_map = {}
        for label, coro in nutrition_tasks.items():
            nutrition_map[label] = await coro

        # Build detections list
        for label, conf, xyxy, portion_grams in box_data:
            nut = nutrition_map.get(label, {})

            cal = (portion_grams / 100.0) * nut.get("calories", 150)
            prot = (portion_grams / 100.0) * nut.get("protein", 5.0)
            carbs = (portion_grams / 100.0) * nut.get("carbs", 10.0)
            fat = (portion_grams / 100.0) * nut.get("fat", 5.0)
            fiber = (portion_grams / 100.0) * nut.get("fiber", 0.0)

            total_calories += cal
            total_protein += prot
            total_carbs += carbs
            total_fat += fat
            total_fiber += fiber

            detections.append({
                "food": label,
                "confidence": round(conf, 2),
                "bbox": [round(coord, 2) for coord in xyxy],
                "portion_grams": round(portion_grams, 2),
                "calories": round(cal, 2),
                "protein": round(prot, 2),
                "carbs": round(carbs, 2),
                "fat": round(fat, 2),
                "fiber": round(fiber, 2),
                "nutrition_source": nut.get("source", "default"),
                "usda_description": nut.get("description", label),
            })

        return {
            "detections": detections,
            "nutrition": {
                "totalCalories": round(total_calories, 2),
                "totalProtein": round(total_protein, 2),
                "totalCarbs": round(total_carbs, 2),
                "totalFat": round(total_fat, 2),
                "totalFiber": round(total_fiber, 2),
            },
        }

    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Prediction error: {str(e)}"
        )


@app.post("/predict")
async def predict(file: UploadFile = File(...)):
    """
    Handle food image prediction using YOLOv8.
    """
    contents = await file.read()
    result = await predict_food_image(contents)
    return result


@app.post("/recommend-diet", response_model=DietRecommendationResponse)
async def recommend_diet(data: DietRecommendationRequest):
    """
    Personalized Diet Recommendation using hybrid logic (Rule Engine + Scoring Engine).
    """
    try:
        user_profile = {
            "age": data.age,
            "weight": data.weight,
            "height": data.height,
            "gender": data.gender,
            "activityLevel": data.activityLevel,
            "healthCondition": data.healthCondition,
            "allergies": data.allergies,
            "dietaryPreference": data.dietType,
            "fitnessGoal": data.fitnessGoal
        }
        recommendation = advanced_recommend_diet(user_profile)
        return recommendation
    except Exception as e:
        import traceback
        traceback.print_exc()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Recommendation error: {str(e)}"
        )


if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)