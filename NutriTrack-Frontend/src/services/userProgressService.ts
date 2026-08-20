import { db } from '../firebase/config';
import {
    collection, query, where, getDocs, getDoc, doc,
    orderBy, limit, Timestamp
} from 'firebase/firestore';
import { calculateDynamicCalories } from './tracking';

// Types 

export interface UserProfile {
    id: string;
    name: string;
    email: string;
    age: number;
    gender: string;
    weight: number;
    height: number;
    activityLevel: string;
    fitnessGoal: string;
    healthCondition: string;
    dailyCalorieGoal: number;
    proteinGoal: number;
    carbsGoal: number;
    fatsGoal: number;
}

export interface FoodLogEntry {
    id: string;
    foodName: string;
    calories: number;
    protein: number;
    carbs: number;
    fats: number;
    mealType: string;
    date: string;
    createdAt: Date;
}

export interface DailyCalorieRecord {
    date: string;
    label: string;
    calories: number;
}

export interface WeightRecord {
    date: string;
    weight: number;
}

export interface MacroDistribution {
    protein: number;
    carbs: number;
    fats: number;
}

export type ComplianceLevel = 'low' | 'moderate' | 'good';
export type GoalStatus = 'on-track' | 'needs-improvement' | 'off-track' | 'no-data';
export type WeightTrend = 'gain' | 'loss' | 'stable' | 'insufficient-data';

export interface ComplianceResult {
    percentage: number;
    level: ComplianceLevel;
    label: string;
    dailyAvgCalories: number;
    dailyGoal: number;
}

export interface GoalAchievementResult {
    status: GoalStatus;
    label: string;
    calorieCompliance: number;
    macroBalance: number;
    loggingConsistency: number;
    overallScore: number;
}

export interface UserProgressPayload {
    profile: UserProfile;
    compliance: ComplianceResult;
    weightHistory: WeightRecord[];
    weightTrend: WeightTrend;
    goalAchievement: GoalAchievementResult;
    recentLogs: FoodLogEntry[];
    calorieTrend: DailyCalorieRecord[];
    macroDistribution: MacroDistribution;
}

// Helpers 
const parseFoodLogDoc = (d: any): FoodLogEntry => {
    const data = d.data();
    const ts: Date = data.createdAt?.toDate?.() ?? new Date();
    return {
        id: d.id,
        foodName: data.food?.name || data.foodName || 'Meal',
        calories: data.food?.kcal || data.calories || 0,
        protein: data.food?.protein || data.protein || 0,
        carbs: data.food?.carbs || data.carbs || 0,
        fats: data.food?.fats || data.fats || 0,
        mealType: data.mealType || 'Snack',
        date: ts.toISOString().split('T')[0],
        createdAt: ts,
    };
};

const getDayLabel = (dateStr: string): string => {
    const d = new Date(dateStr + 'T00:00:00');
    return d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
};

// Core Fetchers

/** Fetch the full user profile with goal defaults */
export const fetchUserProfile = async (userId: string): Promise<UserProfile> => {
    const snap = await getDoc(doc(db, 'users', userId));
    if (!snap.exists()) throw new Error('User not found');
    const d = snap.data();
    const dynamicCal = calculateDynamicCalories(d);
    return {
        id: userId,
        name: d.name || 'User',
        email: d.email || '',
        age: d.age || 0,
        gender: d.gender || '',
        weight: d.weight || 0,
        height: d.height || 0,
        activityLevel: d.activityLevel || 'moderate',
        fitnessGoal: d.fitnessGoal || 'maintain',
        healthCondition: d.healthCondition || 'None',
        dailyCalorieGoal: d.dailyCalorieGoal || dynamicCal,
        proteinGoal: d.proteinGoal || Math.round(dynamicCal * 0.3 / 4),
        carbsGoal: d.carbsGoal || Math.round(dynamicCal * 0.4 / 4),
        fatsGoal: d.fatsGoal || Math.round(dynamicCal * 0.3 / 9),
    };
};

/** Fetch last N food logs for a user */
export const fetchRecentFoodLogs = async (userId: string, count: number = 10): Promise<FoodLogEntry[]> => {
    const ref = collection(db, 'food_logs');
    let snap;
    try {
        snap = await getDocs(
            query(ref, where('userId', '==', userId), orderBy('createdAt', 'desc'), limit(count))
        );
    } catch {
        // Fallback if composite index is missing or permission denied on ordered query
        try {
            snap = await getDocs(query(ref, where('userId', '==', userId)));
        } catch {
            return [];
        }
    }
    const logs = snap.docs.map(parseFoodLogDoc);
    return logs.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime()).slice(0, count);
};

/** Fetch food logs for a date range (for calorie trend) */
export const fetchFoodLogsInRange = async (
    userId: string,
    startDate: Date,
    endDate: Date
): Promise<FoodLogEntry[]> => {
    const ref = collection(db, 'food_logs');
    let snap;
    try {
        snap = await getDocs(
            query(
                ref,
                where('userId', '==', userId),
                where('createdAt', '>=', Timestamp.fromDate(startDate)),
                where('createdAt', '<=', Timestamp.fromDate(endDate)),
                orderBy('createdAt', 'asc')
            )
        );
    } catch {
        try {
            snap = await getDocs(query(ref, where('userId', '==', userId)));
        } catch {
            return [];
        }
    }
    return snap.docs
        .map(parseFoodLogDoc)
        .filter(l => l.createdAt >= startDate && l.createdAt <= endDate)
        .sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());
};

/** Fetch weight history from weight_logs or fall back to user profile */
export const fetchWeightHistory = async (userId: string): Promise<WeightRecord[]> => {
    // Try dedicated weight_logs collection first
    const ref = collection(db, 'weight_logs');
    try {
        const snap = await getDocs(
            query(ref, where('userId', '==', userId), orderBy('createdAt', 'asc'))
        );
        if (snap.size > 0) {
            return snap.docs.map(d => {
                const data = d.data();
                return {
                    date: data.createdAt?.toDate?.().toISOString().split('T')[0] || '',
                    weight: data.weight || 0,
                };
            });
        }
    } catch {
        // Collection may not exist — fallback below
    }

    // Fallback: use current weight from user profile
    const uSnap = await getDoc(doc(db, 'users', userId));
    if (uSnap.exists() && uSnap.data().weight) {
        return [{ date: new Date().toISOString().split('T')[0], weight: uSnap.data().weight }];
    }
    return [];
};


/** Compute calorie compliance from recent logs against daily goal */
export const computeCalorieCompliance = (
    logs: FoodLogEntry[],
    dailyGoal: number
): ComplianceResult => {
    if (logs.length === 0 || dailyGoal <= 0) {
        return { percentage: 0, level: 'low', label: 'No Data', dailyAvgCalories: 0, dailyGoal };
    }

    // Group by date to get daily totals
    const dailyTotals = new Map<string, number>();
    logs.forEach(log => {
        const current = dailyTotals.get(log.date) || 0;
        dailyTotals.set(log.date, current + log.calories);
    });

    const days = Array.from(dailyTotals.values());
    const totalCalories = days.reduce((s, v) => s + v, 0);
    const avgDaily = totalCalories / days.length;

    // Compliance = how close average is to goal (percentage, capped at 100)
    const ratio = avgDaily / dailyGoal;
    // Perfect compliance is when ratio is between 0.85 and 1.15
    let percentage: number;
    if (ratio >= 0.85 && ratio <= 1.15) {
        percentage = 100;
    } else if (ratio < 0.85) {
        percentage = Math.round((ratio / 0.85) * 100);
    } else {
        // Over-eating: penalize but don't go below 0
        percentage = Math.max(0, Math.round((1 - (ratio - 1.15) / 0.85) * 100));
    }

    percentage = Math.max(0, Math.min(100, percentage));

    let level: ComplianceLevel;
    let label: string;
    if (percentage >= 70) {
        level = 'good';
        label = 'Good Compliance';
    } else if (percentage >= 40) {
        level = 'moderate';
        label = 'Moderate Compliance';
    } else {
        level = 'low';
        label = 'Low Compliance';
    }

    return { percentage, level, label, dailyAvgCalories: Math.round(avgDaily), dailyGoal };
};

/** Determine weight trend from weight history */
export const computeWeightTrend = (history: WeightRecord[]): WeightTrend => {
    if (history.length < 2) return 'insufficient-data';
    const first = history[0].weight;
    const last = history[history.length - 1].weight;
    const diff = last - first;
    if (Math.abs(diff) < 0.5) return 'stable';
    return diff > 0 ? 'gain' : 'loss';
};

/** Build daily calorie trend data for the last N days */
export const buildCalorieTrend = (
    logs: FoodLogEntry[],
    days: number = 14
): DailyCalorieRecord[] => {
    const now = new Date();
    const records: DailyCalorieRecord[] = [];

    for (let i = days - 1; i >= 0; i--) {
        const d = new Date(now);
        d.setDate(d.getDate() - i);
        const dateStr = d.toISOString().split('T')[0];
        const dayLogs = logs.filter(l => l.date === dateStr);
        const totalCal = dayLogs.reduce((s, l) => s + l.calories, 0);
        records.push({
            date: dateStr,
            label: getDayLabel(dateStr),
            calories: Math.round(totalCal),
        });
    }
    return records;
};

/** Compute macro distribution totals from logs */
export const computeMacroDistribution = (logs: FoodLogEntry[]): MacroDistribution => {
    const totals = logs.reduce(
        (acc, l) => ({
            protein: acc.protein + l.protein,
            carbs: acc.carbs + l.carbs,
            fats: acc.fats + l.fats,
        }),
        { protein: 0, carbs: 0, fats: 0 }
    );
    return {
        protein: Math.round(totals.protein),
        carbs: Math.round(totals.carbs),
        fats: Math.round(totals.fats),
    };
};

/** Compute goal achievement status considering multiple factors */
export const computeGoalAchievement = (
    compliance: ComplianceResult,
    macros: MacroDistribution,
    profile: UserProfile,
    logsCount: number,
    daysCovered: number
): GoalAchievementResult => {
    if (logsCount === 0) {
        return {
            status: 'no-data',
            label: 'No Data',
            calorieCompliance: 0,
            macroBalance: 0,
            loggingConsistency: 0,
            overallScore: 0,
        };
    }

    // 1. Calorie compliance score (0–100)
    const calorieScore = compliance.percentage;

    // 2. Macro balance score: how well macros match goals
    const totalMacroGrams = macros.protein + macros.carbs + macros.fats;
    let macroScore = 50; // default if no data
    if (totalMacroGrams > 0 && profile.proteinGoal > 0) {
        const proteinRatio = macros.protein / (profile.proteinGoal * daysCovered);
        const carbsRatio = macros.carbs / (profile.carbsGoal * daysCovered);
        const fatsRatio = macros.fats / (profile.fatsGoal * daysCovered);
        const avgDeviation = (
            Math.abs(1 - proteinRatio) + Math.abs(1 - carbsRatio) + Math.abs(1 - fatsRatio)
        ) / 3;
        macroScore = Math.max(0, Math.min(100, Math.round((1 - avgDeviation) * 100)));
    }

    // 3. Logging consistency: logs per day
    const logsPerDay = daysCovered > 0 ? logsCount / daysCovered : 0;
    // Expect at least 2 logs per day for good consistency
    const consistencyScore = Math.min(100, Math.round((logsPerDay / 2) * 100));

    // Weighted overall: 50% calories, 25% macros, 25% consistency
    const overallScore = Math.round(
        calorieScore * 0.5 + macroScore * 0.25 + consistencyScore * 0.25
    );

    let status: GoalStatus;
    let label: string;
    if (overallScore >= 70) {
        status = 'on-track';
        label = 'On Track';
    } else if (overallScore >= 40) {
        status = 'needs-improvement';
        label = 'Needs Improvement';
    } else {
        status = 'off-track';
        label = 'Off Track';
    }

    return {
        status,
        label,
        calorieCompliance: calorieScore,
        macroBalance: macroScore,
        loggingConsistency: consistencyScore,
        overallScore,
    };
};

//Main Aggregator


export const getUserProgressData = async (
    userId: string,
    trendDays: number = 14
): Promise<UserProgressPayload> => {
    // Fetch all data in parallel
    const [profile, recentLogs, weightHistory] = await Promise.all([
        fetchUserProfile(userId),
        fetchRecentFoodLogs(userId, 50), // More logs for better computation
        fetchWeightHistory(userId),
    ]);

    // Build calorie trend for the last N days
    const now = new Date();
    const startDate = new Date(now);
    startDate.setDate(startDate.getDate() - (trendDays - 1));
    startDate.setHours(0, 0, 0, 0);

    // Use the fetched recent logs for trend (they are already sorted)
    const trendLogs = recentLogs.filter(l => l.createdAt >= startDate);
    const calorieTrend = buildCalorieTrend(recentLogs, trendDays);

    // Compute metrics
    const compliance = computeCalorieCompliance(trendLogs, profile.dailyCalorieGoal);
    const weightTrend = computeWeightTrend(weightHistory);
    const macroDistribution = computeMacroDistribution(trendLogs);

    // Count unique days in trend period
    const uniqueDays = new Set(trendLogs.map(l => l.date)).size;

    const goalAchievement = computeGoalAchievement(
        compliance,
        macroDistribution,
        profile,
        trendLogs.length,
        Math.max(1, uniqueDays)
    );

    return {
        profile,
        compliance,
        weightHistory,
        weightTrend,
        goalAchievement,
        recentLogs: recentLogs.slice(0, 10), // Only 10 for display
        calorieTrend,
        macroDistribution,
    };
};
