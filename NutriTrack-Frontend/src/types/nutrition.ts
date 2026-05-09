
export interface FoodItem {
    id?: number | string;
    name: string;
    calories: number;
    protein: number;
    carbs: number;
    fats: number;
    confidence?: number;
    portion?: string;
    serving_size?: string;
    image?: string;
    time?: string;
    [key: string]: unknown;
}

export interface RecentUpload extends FoodItem {
    id: number;
    image: string;
    time: string;
}

export interface IntakeItem extends FoodItem {
    id: number | string;
    meal: string;
    time: string;
}

export interface IntakeHistory {
    today: IntakeItem[];
    dailyGoal: number;
    consumed: number;
    compliance: string;
    macros?: {
        protein: number;
        carbs: number;
        fats: number;
    };
}

export interface DietPlan {
    active: boolean;
    name: string;
    dailyCalories: number;
    progress: number;
    daysRemaining: number;
    macros: { protein: number; carbs: number; fats: number };
    nutritionist: string;
    startDate: string;
    endDate: string;
}

export interface Nutritionist {
    id: number | string;
    name: string;
    email: string;
    experience: string;
    specialization: string;
    rating: number;
    clients_count: number;
    image?: string;
}

export interface FoodLog {
    id: string;
    userId: string;
    foods: string[];
    calories: number;
    protein: number;
    carbs: number;
    fats: number;
    imageUrl?: string;
    createdAt: Date;
}

export interface FirestoreFoodLog {
    userId: string;
    foods: string[];
    calories: number;
    protein: number;
    carbs: number;
    fats: number;
    imageUrl?: string;
    createdAt: unknown;
}

// ========== AI Food Detection Types ==========

/** Single detection item from the YOLO backend */
export interface Detection {
    food: string;
    confidence: number;
    bbox: [number, number, number, number]; // [x1, y1, x2, y2]
    portion_grams?: number;
    calories?: number;
    protein?: number;
    carbs?: number;
    fat?: number;
    fiber?: number;
    nutrition_source?: string;
    usda_description?: string;
}

export interface NutritionSummaryData {
    totalCalories: number;
    totalCarbs: number;
    totalProtein: number;
    totalFat: number;
    totalFiber?: number;
}

/** Firestore meals collection document */
export interface MealDocument {
    userId: string;
    foods: Array<{
        name: string;
        calories: number;
        protein: number;
        carbs: number;
        fat: number;
        fiber: number;
    }>;
    totals: {
        calories: number;
        protein: number;
        carbs: number;
        fat: number;
        fiber: number;
    };
    createdAt: unknown; // Firestore Timestamp
}

/** Raw API response from POST /predict */
export interface PredictResponse {
    detections: Detection[];
    nutrition: NutritionSummaryData;
    imageUrl?: string;
}

/** UI-ready detection result with image context for bounding box rendering */
export interface DetectionResult {
    detections: Detection[];
    nutrition: NutritionSummaryData;
    imageUrl: string;
    imageWidth: number;
    imageHeight: number;
}
