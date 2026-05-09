import { db } from '../firebase/config';
import { collection, addDoc, query, where, getDocs, orderBy, Timestamp, DocumentData, serverTimestamp, deleteDoc, doc, limit, onSnapshot, writeBatch, QuerySnapshot, Query } from 'firebase/firestore';
import type { Detection, NutritionSummaryData } from '../types/nutrition';

export interface FoodLog {
    id: string;
    userId: string;
    foodName: string;
    mealType: 'Breakfast' | 'Lunch' | 'Dinner' | 'Snack';
    calories: number;
    protein: number;
    carbs: number;
    fats: number;
    imageUrl?: string;
    createdAt: any;
}

export interface DetectionHistoryItem {
    id: string;
    userId: string;
    foods: any[];
    nutrition: NutritionSummaryData;
    meal: string;
    createdAt: Date;
}

export interface Notification {
    id: string;
    receiverId: string;
    senderId: string;
    senderName: string;
    message: string;
    type: 'request' | 'accept' | 'reject' | 'chat';
    isRead: boolean;
    createdAt: any;
}

const getMealType = () => {
    const hour = new Date().getHours();
    if (hour < 11) return 'Breakfast';
    if (hour < 15) return 'Lunch';
    if (hour < 21) return 'Dinner';
    return 'Snack';
};

// save meal
export const saveMealToFirestore = async (userId: string, detections: Detection[], nutrition: NutritionSummaryData) => {
    const foods = detections.map(d => ({
        name: d.food.replace(/_/g, ' '),
        calories: Math.round(d.calories ?? 0),
        protein: Number((d.protein ?? 0).toFixed(2)),
        carbs: Number((d.carbs ?? 0).toFixed(2)),
        fat: Number((d.fat ?? 0).toFixed(2)),
        fiber: Number((d.fiber ?? 0).toFixed(2)),
    }));

    return (await addDoc(collection(db, 'meals'), {
        userId: userId || 'unknown',
        foods,
        totals: {
            calories: Math.round(nutrition?.totalCalories || 0),
            protein: Number((nutrition?.totalProtein || 0).toFixed(2)),
            carbs: Number((nutrition?.totalCarbs || 0).toFixed(2)),
            fat: Number((nutrition?.totalFat || 0).toFixed(2)),
            fiber: Number((nutrition?.totalFiber || 0).toFixed(2)),
        },
        createdAt: serverTimestamp(),
    })).id;
};

// save detection
export const saveDetectionToFirestore = async (userId: string, detections: Detection[], nutrition: NutritionSummaryData) => {
    const foods = detections.map(d => ({
        name: d.food, confidence: d.confidence, portion_grams: d.portion_grams,
        calories: d.calories, protein: d.protein, carbs: d.carbs, fat: d.fat
    }));

    return (await addDoc(collection(db, 'food_detections'), { userId, foods, nutrition, meal: getMealType(), createdAt: serverTimestamp() })).id;
};

// get detections
export const getUserDetections = async (userId: string, days?: number) => {
    const ref = collection(db, 'food_detections');
    let q = query(ref, where("userId", "==", userId), orderBy("createdAt", "desc"));

    if (days !== undefined) {
        const date = new Date();
        date.setDate(date.getDate() - days);
        q = query(ref, where("userId", "==", userId), where("createdAt", ">=", Timestamp.fromDate(date)), orderBy("createdAt", "desc"));
    }

    try {
        const snap = await getDocs(q);
        return snap.docs.map(d => ({ id: d.id, ...d.data(), createdAt: d.data().createdAt?.toDate() || new Date() } as any));
    } catch {
        const snap = await getDocs(query(ref, where("userId", "==", userId)));
        return snap.docs.map(d => ({ id: d.id, ...d.data(), createdAt: d.data().createdAt?.toDate() || new Date() } as any)).sort((a, b) => b.createdAt - a.createdAt);
    }
};

// delete detection
export const deleteDetection = (id: string) => deleteDoc(doc(db, 'food_detections', id));

// save food log
export const saveFoodLogToFirestore = async (userId: string, foodName: string, nutrition: NutritionSummaryData, mealType?: string, imageUrl?: string) => {
    return (await addDoc(collection(db, 'food_logs'), {
        userId, foodName, mealType: mealType || getMealType(),
        calories: Math.round(nutrition.totalCalories),
        protein: Number(nutrition.totalProtein.toFixed(1)),
        carbs: Number(nutrition.totalCarbs.toFixed(1)),
        fats: Number(nutrition.totalFat.toFixed(1)),
        imageUrl: imageUrl || '', createdAt: serverTimestamp()
    })).id;
};

// manual log
export const addManualFoodLogToFirestore = async (userId: string, data: any) => {
    return (await addDoc(collection(db, 'food_logs'), { userId, ...data, createdAt: serverTimestamp() })).id;
};

// today's logs
export const getTodayFoodLogs = async (userId: string): Promise<FoodLog[]> => {
    const start = new Date();
    start.setHours(0, 0, 0, 0);

    const ref = collection(db, 'food_logs');
    const q = query(ref, where("userId", "==", userId), where("createdAt", ">=", Timestamp.fromDate(start)), orderBy("createdAt", "desc"));

    try {
        const snap = await getDocs(q);
        return snap.docs.map(d => ({ id: d.id, ...d.data(), createdAt: d.data().createdAt?.toDate() || new Date() } as any));
    } catch {
        const snap = await getDocs(query(ref, where("userId", "==", userId)));
        return snap.docs.map(d => ({ id: d.id, ...d.data(), createdAt: d.data().createdAt?.toDate() || new Date() } as any))
            .filter(l => l.createdAt >= start)
            .sort((a, b) => b.createdAt - a.createdAt);
    }
};

// notifications
export const addNotification = (data: any) => addDoc(collection(db, 'notifications'), { ...data, isRead: false, createdAt: serverTimestamp() });

export const subscribeToNotifications = (userId: string, cb: any) => {
    const ref = collection(db, 'notifications');
    const q = query(ref, where('receiverId', '==', userId), orderBy('createdAt', 'desc'));

    return onSnapshot(q, (s) => {
        cb(s.docs.map(d => ({ id: d.id, ...d.data() })));
    }, () => {
        onSnapshot(query(ref, where('receiverId', '==', userId)), (s) => {
            cb(s.docs.map(d => ({ id: d.id, ...d.data() })).sort((a: any, b: any) => (b.createdAt?.toDate?.() || 0) - (a.createdAt?.toDate?.() || 0)));
        });
    });
};

export const markNotificationsAsRead = async (notifications: Notification[]) => {
    const unread = notifications.filter(n => !n.isRead);
    if (!unread.length) return;
    const batch = writeBatch(db);
    unread.forEach(n => batch.update(doc(db, 'notifications', n.id), { isRead: true }));
    await batch.commit();
};

// --- Consolidated Meal Tracking System (JS SDK v12) ---
// Using collection: food_logs as per requirement

export const trackMealToFirestore = async (userId: string, mealType: string, food: {name: string, kcal: number, protein: number, carbs: number, fats: number}, source: 'ai' | 'manual' = 'ai', portion?: string) => {
    const date = new Date().toISOString().split('T')[0];
    return await addDoc(collection(db, 'food_logs'), {
        userId,
        date,
        mealType: mealType.toLowerCase(),
        source,
        portion: portion || '',
        food: {
            name: food.name,
            kcal: Number(food.kcal),
            protein: Number(food.protein),
            carbs: Number(food.carbs),
            fats: Number(food.fats)
        },
        calories: Number(food.kcal), // Redundant but helpful for legacy compatibility
        protein: Number(food.protein),
        carbs: Number(food.carbs),
        fats: Number(food.fats),
        foodName: food.name,
        createdAt: serverTimestamp()
    });
};

export const getDailyTrackingFromFirestore = async (userId: string) => {
    const today = new Date().toISOString().split('T')[0];
    const ref = collection(db, 'food_logs');
    
    // We try to use the 'date' field if it exists, otherwise fall back to createdAt (handled in post-processing)
    const q = query(ref, where("userId", "==", userId), where("date", "==", today));
    
    const snap = await getDocs(q);
    const totals = {
        totalCalories: 0,
        totalProtein: 0,
        totalCarbs: 0,
        totalFats: 0,
        meals: [] as any[]
    };
    
    snap.forEach(d => {
        const data = d.data();
        const kcal = data.food?.kcal || data.calories || 0;
        const p = data.food?.protein || data.protein || 0;
        const c = data.food?.carbs || data.carbs || 0;
        const f = data.food?.fats || data.fats || 0;
        
        totals.totalCalories += kcal;
        totals.totalProtein += p;
        totals.totalCarbs += c;
        totals.totalFats += f;
        
        totals.meals.push({
            id: d.id,
            mealType: data.mealType,
            name: data.food?.name || data.foodName || 'Unknown',
            kcal,
            protein: p,
            carbs: c,
            fats: f,
            source: data.source || 'ai'
        });
    });
    
    return totals;
};
