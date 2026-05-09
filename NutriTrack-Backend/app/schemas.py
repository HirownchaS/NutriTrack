from pydantic import BaseModel
from typing import List, Optional, Dict
from datetime import datetime

class FoodItem(BaseModel):
    name: str
    confidence: float
    calories: float
    protein: float
    carbs: float
    fat: float
    portion: str

class FoodLogBase(BaseModel):
    user_id: str
    image_url: str
    detected_foods: List[FoodItem]
    total_calories: float
    total_protein: float
    total_carbs: float
    total_fats: float

class FoodLogCreate(FoodLogBase):
    pass

class FoodLog(FoodLogBase):
    id: int
    timestamp: datetime
    nutritionist_feedback: Optional[str] = None

    class Config:
        from_attributes = True

class MessageBase(BaseModel):
    sender_id: str
    receiver_id: str
    content: str

class MessageCreate(MessageBase):
    pass

class Message(MessageBase):
    id: int
    status: str
    timestamp: datetime

    class Config:
        from_attributes = True

# --- User Schemas ---
class UserBase(BaseModel):
    email: str
    role: str = "user"
    status: str = "Active"

class UserCreate(UserBase):
    password: str

class UserUpdate(BaseModel):
    role: Optional[str] = None
    status: Optional[str] = None

class User(UserBase):
    id: str
    created_at: datetime

    class Config:
        from_attributes = True

# --- Food Database Schemas ---
class FoodItemBase(BaseModel):
    name: str
    calories: float
    proteins: float
    carbs: float
    fats: float
    serving_size: str

class FoodItemCreate(FoodItemBase):
    pass

class FoodItem(FoodItemBase):
    id: int

    class Config:
        from_attributes = True

# --- Admin & System Schemas ---
class SystemStats(BaseModel):
    totalUsers: int
    totalNutritionists: int
    totalFoodLogs: int
    activeDietPlans: int
    pendingNutritionistRequests: int
    systemWideAvgCalories: float

class AuditLog(BaseModel):
    id: int
    user_id: str
    action: str
    details: str
    timestamp: datetime

    class Config:
        from_attributes = True

class UserProfileUpdate(BaseModel):
    name: Optional[str] = None
    age: Optional[int] = None
    weight: Optional[float] = None
    height: Optional[float] = None
    goal: Optional[str] = None
    healthCondition: Optional[str] = None

class UserProfile(BaseModel):
    id: int
    user_id: str
    name: str
    age: int
    weight: float
    height: float
    goal: str
    healthCondition: str

    class Config:
        from_attributes = True

# --- Diet Recommendation Schemas ---
class DietRecommendationRequest(BaseModel):
    age: int
    weight: float
    height: float
    gender: str
    activityLevel: str
    healthCondition: str
    allergies: Optional[str] = "none"
    dietType: Optional[str] = "none"
    fitnessGoal: str

class AdvancedMealItem(BaseModel):
    food_name: str
    calories: float
    protein_g: float
    carbs_g: float
    fat_g: float

class AdvancedMealPlan(BaseModel):
    breakfast: List[AdvancedMealItem]
    lunch: List[AdvancedMealItem]
    dinner: List[AdvancedMealItem]
    snacks: List[AdvancedMealItem]

class DietRecommendationResponse(BaseModel):
    calories: int
    macros: Dict[str, int]
    meal_plan: AdvancedMealPlan
    explanation: str
# End of schemas
