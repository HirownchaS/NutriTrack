import axios from 'axios';
import { db, auth } from '../firebase/config';
import { collection, query, where, getDocs, addDoc, doc, updateDoc, serverTimestamp, getDoc, orderBy, onSnapshot, setDoc, Timestamp, limit, writeBatch, startAfter } from 'firebase/firestore';
import { addNotification } from './firestore';
import type { PredictResponse } from '../types/nutrition';

const api = axios.create({
    baseURL: import.meta.env.VITE_API_URL || 'http://localhost:8000',
    timeout: 120000,
    headers: { 'Content-Type': 'application/json' },
});

// attach jwt token
api.interceptors.request.use((config) => {
    const token = localStorage.getItem('token');
    if (token) config.headers.Authorization = `Bearer ${token}`;
    return config;
}, (error) => Promise.reject(error));

// calculate calories
export const calculateDynamicCalories = (userProfile: any): number => {
    if (!userProfile) return 2000;
    const { weight = 70, height = 170, age = 30, gender = 'male', activityLevel = 'moderate', fitnessGoal = 'maintain' } = userProfile;
    
    let bmr = (10 * weight) + (6.25 * height) - (5 * age) + (gender.toLowerCase() === 'male' ? 5 : -161);
    
    const multipliers: any = { light: 1.375, moderate: 1.55, active: 1.725, extreme: 1.9 };
    const activeKey = Object.keys(multipliers).find(k => activityLevel.toLowerCase().includes(k)) || 'moderate';
    let tdee = bmr * multipliers[activeKey];
    
    if (fitnessGoal.toLowerCase().includes('lose')) tdee -= 500;
    else if (fitnessGoal.toLowerCase().includes('build') || fitnessGoal.toLowerCase().includes('gain')) tdee += 300;
    
    if ((userProfile.healthCondition || '').toLowerCase().includes('thyroid')) tdee -= 100;
    
    return Math.max(1200, Math.round(tdee));
};

// api endpoints
export const uploadImage = async (formData: FormData) => {
    const res = await api.post<PredictResponse>('/predict', formData, { headers: { 'Content-Type': undefined }, timeout: 60000 });
    return res.data;
};

export const getNutritionSummary = async () => {
    const { getTodayFoodLogs } = await import('./firestore');
    const user = auth.currentUser;
    if (!user) throw new Error("Unauthenticated");

    const logs = await getTodayFoodLogs(user.uid);
    const totals = logs.reduce((acc, log) => ({
        calories: acc.calories + (log.calories || 0),
        protein: acc.protein + (log.protein || 0),
        carbs: acc.carbs + (log.carbs || 0),
        fats: acc.fats + (log.fats || 0)
    }), { calories: 0, protein: 0, carbs: 0, fats: 0 });

    return {
        data: {
            totalCalories: Math.round(totals.calories),
            protein: Number(totals.protein.toFixed(1)),
            carbs: Number(totals.carbs.toFixed(1)),
            fats: Number(totals.fats.toFixed(1))
        }
    };
};

export const setGoals = async (goals: any) => {
    const user = auth.currentUser;
    if (!user) throw new Error('Unauthenticated');
    await updateDoc(doc(db, 'users', user.uid), {
        dailyCalorieGoal: goals.calories,
        proteinGoal: goals.protein,
        carbsGoal: goals.carbs,
        fatsGoal: goals.fats,
        updatedAt: serverTimestamp()
    });
    return { success: true };
};

export const getProgress = async (period: 'daily' | 'weekly' | 'monthly' = 'daily') => {
    const user = auth.currentUser;
    if (!user) throw new Error('Unauthenticated');

    const now = new Date();
    let start = new Date();
    let count = 7;
    let labels: string[] = [];

    if (period === 'daily') {
        start.setDate(now.getDate() - 6);
        start.setHours(0, 0, 0, 0);
        const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
        for (let i = 0; i < 7; i++) {
            const d = new Date(start);
            d.setDate(start.getDate() + i);
            labels.push(days[d.getDay()]);
        }
    } else if (period === 'weekly') {
        start.setDate(now.getDate() - 27);
        start.setHours(0, 0, 0, 0);
        count = 4;
        labels = ['Week 1', 'Week 2', 'Week 3', 'Week 4'];
    } else if (period === 'monthly') {
        start.setMonth(now.getMonth() - 5);
        start.setDate(1);
        start.setHours(0, 0, 0, 0);
        count = 6;
        const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
        for (let i = 0; i < 6; i++) {
            const d = new Date(start);
            d.setMonth(start.getMonth() + i);
            labels.push(months[d.getMonth()]);
        }
    }

    const logsRef = collection(db, 'food_logs');
    let snap;
    try {
        snap = await getDocs(query(logsRef, where('userId', '==', user.uid), where('createdAt', '>=', Timestamp.fromDate(start)), orderBy('createdAt', 'asc')));
    } catch {
        snap = await getDocs(query(logsRef, where('userId', '==', user.uid)));
    }

    const calories = Array(count).fill(0);
    let p = 0, c = 0, f = 0;

    snap.forEach(d => {
        const data = d.data();
        const ts = data.createdAt?.toDate?.() || new Date();
        if (ts < start) return;

        let idx = 0;
        if (period === 'daily') idx = Math.floor((ts.getTime() - start.getTime()) / 86400000);
        else if (period === 'weekly') idx = Math.floor((ts.getTime() - start.getTime()) / (86400000 * 7));
        else if (period === 'monthly') idx = (ts.getFullYear() - start.getFullYear()) * 12 + ts.getMonth() - start.getMonth();

        if (idx >= 0 && idx < count) calories[idx] += data.calories || 0;
        p += data.protein || 0; c += data.carbs || 0; f += data.fats || 0;
    });

    let target = 2000;
    const uDoc = await getDoc(doc(db, 'users', user.uid));
    if (uDoc.exists()) {
        const d = uDoc.data();
        target = d.dailyCalorieGoal || calculateDynamicCalories(d);
    }

    if (period === 'weekly') target *= 7;
    if (period === 'monthly') target *= 30;

    return { data: { labels, caloriesData: calories, targetGoal: target, macroBreakdown: { protein: Math.round(p), carbs: Math.round(c), fats: Math.round(f) } } };
};

export const getDietRecommendation = async () => {
    const user = auth.currentUser;
    if (!user) throw new Error("Unauthenticated");

    const uDoc = await getDoc(doc(db, 'users', user.uid));
    const u = uDoc.data() || {};
    
    // Call the updated backend endpoint with the new schema
    try {
        const res = await api.post('/recommend-diet', {
            age: Number(u.age) || 30,
            gender: u.gender || 'male',
            weight: Number(u.weight) || 70,
            height: Number(u.height) || 170,
            activityLevel: u.activityLevel || 'moderate',
            fitnessGoal: u.fitnessGoal || 'maintain',
            healthCondition: u.healthCondition || 'none',
            allergies: u.allergies || 'none',
            dietType: u.dietaryPreference || 'none'
        });
        
        const data = res.data;
        
        // Map new meal_plan structure to old suggestions format for backward compatibility with UI
        const suggestions: any[] = [];
        if (data.meal_plan) {
            Object.entries(data.meal_plan).forEach(([type, items]: [string, any]) => {
                items.forEach((item: any) => {
                    suggestions.push({
                        name: `${type.charAt(0).toUpperCase() + type.slice(1)}: ${item.food_name}`,
                        kcal: Math.round(item.calories),
                        p: Math.round(item.protein_g),
                        c: Math.round(item.carbs_g),
                        f: Math.round(item.fat_g),
                        desc: `Selected for its high nutritional quality and compliance with your fitness profile.`
                    });
                });
            });
        }
        
        const finalData = {
            goal: u.fitnessGoal || 'Wellness',
            calories: u.dailyCalorieGoal || data.calories,
            protein: u.proteinGoal || data.macros?.protein,
            carbs: u.carbsGoal || data.macros?.carbs,
            fats: u.fatsGoal || data.macros?.fats,
            mealPlan: data.explanation,
            suggestions: suggestions, 
            ...data
        };
        
        await setDoc(doc(db, 'diet_recommendations', user.uid), {
            userId: user.uid, ...finalData, status: 'approved', createdAt: serverTimestamp()
        });

        return finalData;
    } catch (err) {
        console.error("Diet Recommendation Error:", err);
        throw err;
    }
};

// nutritionist apis
export const getAssignedUsers = async () => {
    const user = auth.currentUser;
    if (!user) throw new Error("Unauthenticated");

    const snaps = await getDocs(query(collection(db, 'nutritionist_requests'), where('nutritionistId', '==', user.uid)));
    const items = await Promise.all(snaps.docs.map(async (s) => {
        const d = s.data();
        const uDoc = await getDoc(doc(db, 'users', d.userId));
        const u = uDoc.exists() ? uDoc.data() : {};
        return {
            id: s.id, userId: d.userId, name: u.name || 'User', email: u.email || '',
            age: u.age, healthCondition: u.healthCondition || 'None',
            fitnessGoal: u.fitnessGoal || 'Wellness', status: d.status || 'pending',
            date: d.createdAt ? d.createdAt.toDate().toISOString().split('T')[0] : new Date().toISOString().split('T')[0]
        };
    }));

    return { data: { assigned: items.filter(i => i.status === 'accepted'), requests: items.filter(i => i.status === 'pending') } };
};

export const handleUserRequest = async (requestId: string, status: 'accepted' | 'rejected') => {
    const user = auth.currentUser;
    if (!user) throw new Error("Unauthenticated");

    const ref = doc(db, 'nutritionist_requests', requestId);
    const snap = await getDoc(ref);
    if (!snap.exists()) throw new Error("Not found");
    
    const d = snap.data();
    if (d.status === status) return { success: true };
    
    await updateDoc(ref, { status });
    const nDoc = await getDoc(doc(db, 'users', user.uid));
    const nName = nDoc.exists() ? nDoc.data().name : 'Nutritionist';

    if (status === 'accepted') {
        await updateDoc(doc(db, 'users', d.userId), { nutritionistId: user.uid });
        const chatId = [d.userId, user.uid].sort().join('_');
        await setDoc(doc(db, 'chats', chatId), { userId: d.userId, nutritionistId: user.uid, updatedAt: serverTimestamp(), createdAt: serverTimestamp() }, { merge: true });
    }

    await addNotification({
        receiverId: d.userId, senderId: user.uid, senderName: nName,
        message: `Your request has been ${status} by the nutritionist`,
        type: status === 'accepted' ? 'accept' : 'reject'
    });

    return { success: true };
};

export const getUserFullData = async (userId: string) => {
    const uDoc = await getDoc(doc(db, 'users', userId));
    const u = uDoc.data() || {};
    
    const logsRef = collection(db, 'food_logs');
    let logs;
    try {
        logs = await getDocs(query(logsRef, where('userId', '==', userId), orderBy('createdAt', 'desc'), limit(10)));
    } catch {
        logs = await getDocs(query(logsRef, where('userId', '==', userId)));
    }

    const recent = logs.docs.map(d => {
        const data = d.data();
        return {
            id: d.id, meal: data.foodName || 'Meal', mealType: data.mealType || 'Snack',
            calories: data.calories || 0, protein: data.protein || 0,
            carbs: data.carbs || 0, fats: data.fats || 0,
            date: data.createdAt?.toDate?.().toISOString().split('T')[0] || '',
            status: 'approved'
        };
    });

    const planDoc = await getDoc(doc(db, 'diet_recommendations', userId));
    const p = planDoc.exists() ? planDoc.data() : {};

    return { data: { id: userId, name: u.name || 'User', weightProgress: u.weight ? [u.weight] : [], recentLogs: recent, dietPlan: { calories: p.calories || 0, protein: p.protein || 0, carbs: p.carbs || 0, fats: p.fats || 0 } } };
};

export const approveFoodLog = async (logId: string, status: 'approved' | 'rejected', feedback = '') => {
    const logRef = doc(db, 'food_logs', logId);
    const snap = await getDoc(logRef);
    if (!snap.exists()) throw new Error('Log not found');
    const logData = snap.data();

    await updateDoc(logRef, { status, nutritionist_feedback: feedback, updatedAt: serverTimestamp() });
    
    await addNotification({
        receiverId: logData.userId,
        senderId: auth.currentUser?.uid || 'system',
        senderName: 'Nutritionist',
        message: `Your meal "${logData.food?.name || logData.foodName || 'log'}" has been ${status}. ${feedback ? 'Feedback: ' + feedback : ''}`,
        type: 'meal_review'
    });

    return { success: true };
};

// messaging
export const sendMessage = async (data: any) => {
    const chatId = [data.sender_id, data.receiver_id].sort().join('_');
    await addDoc(collection(db, 'chats', chatId, 'messages'), { senderId: data.sender_id, receiverId: data.receiver_id, content: data.content, timestamp: serverTimestamp() });
    await setDoc(doc(db, 'chats', chatId), { userId: data.sender_id, nutritionistId: data.receiver_id, updatedAt: serverTimestamp() }, { merge: true });
    
    await addNotification({
        receiverId: data.receiver_id,
        senderId: data.sender_id,
        senderName: data.sender_name || 'User',
        message: `New message from ${data.sender_name || 'User'}: ${data.content.substring(0, 40)}${data.content.length > 40 ? '...' : ''}`,
        type: 'chat'
    });

    return { success: true };
};

export const subscribeToMessages = (uid: string, rid: string, cb: any) => {
    if (!uid || !rid) return () => {};
    const q = query(collection(db, 'chats', [uid, rid].sort().join('_'), 'messages'), orderBy('timestamp', 'asc'));
    return onSnapshot(q, (s) => {
        cb(s.docs.map(d => {
            const data = d.data();
            return { id: d.id, sender_id: data.senderId, receiver_id: data.receiverId, content: data.content, timestamp: data.timestamp?.toDate().toISOString() || new Date().toISOString() };
        }));
    });
};

export const createDietPlan = async (userId: string, data: any) => {
    const user = auth.currentUser;
    if (!user) throw new Error("Unauthenticated");
    await setDoc(doc(db, 'diet_recommendations', userId), { ...data, userId, nutritionistId: user.uid, updatedAt: serverTimestamp() }, { merge: true });
    return { success: true };
};

export const addManualFoodLog = async (data: any) => {
    const { trackMealToFirestore } = await import('./firestore');
    const user = auth.currentUser;
    if (!user) throw new Error("Unauthenticated");
    
    await trackMealToFirestore(
        user.uid,
        data.mealType,
        {
            name: data.foodName,
            kcal: data.calories,
            protein: data.protein,
            carbs: data.carbs,
            fats: data.fats
        },
        'manual',
        data.portion
    );
    return { success: true };
};

// dashboard
export const getNutritionistDashboard = async () => {
    const user = auth.currentUser;
    if (!user) throw new Error('Unauthenticated');

    const assigned = await getDocs(query(collection(db, 'nutritionist_requests'), where('nutritionistId', '==', user.uid), where('status', '==', 'accepted')));
    const pending = await getDocs(query(collection(db, 'nutritionist_requests'), where('nutritionistId', '==', user.uid), where('status', '==', 'pending')));
    
    let activePlans = 0;
    const uids = assigned.docs.map(d => d.data().userId).filter(Boolean);
    for (const id of uids) {
        if ((await getDoc(doc(db, 'diet_recommendations', id))).exists()) activePlans++;
    }

    const activity = [];
    if (uids.length > 0) {
        try {
            const logs = await getDocs(query(collection(db, 'food_logs'), where('userId', 'in', uids.slice(0, 30)), orderBy('createdAt', 'desc'), limit(5)));
            for (const l of logs.docs) {
                const ld = l.data();
                const uDoc = await getDoc(doc(db, 'users', ld.userId));
                activity.push({ id: l.id, type: 'food_log', user: uDoc.data()?.name || 'User', action: `logged ${ld.foodName || 'a meal'} (${ld.calories || 0} kcal)`, time: ld.createdAt ? getRelativeTime(ld.createdAt.toDate()) : 'recently', icon: '📸' });
            }
        } catch {}
    }

    return { data: { stats: { assignedUsers: assigned.size, pendingRequests: pending.size, activePlans }, recentActivity: activity } };
};

function getRelativeTime(date: Date): string {
    const diff = Math.floor((new Date().getTime() - date.getTime()) / 1000);
    if (diff < 60) return 'just now';
    if (diff < 3600) return `${Math.floor(diff / 60)} min ago`;
    if (diff < 86400) return `${Math.floor(diff / 3600)} hr ago`;
    return `${Math.floor(diff / 86400)} day${Math.floor(diff / 86400) > 1 ? 's' : ''} ago`;
}

// user dashboard
export const getRecentFoodUploads = async () => {
    const user = auth.currentUser;
    if (!user) throw new Error('Unauthenticated');

    const logsRef = collection(db, 'food_logs');
    let snap;
    try {
        snap = await getDocs(query(logsRef, where('userId', '==', user.uid), orderBy('createdAt', 'desc'), limit(3)));
    } catch {
        snap = await getDocs(query(logsRef, where('userId', '==', user.uid)));
    }

    const emojis: any = { rice: '🍚', chicken: '🍗', salad: '🥗', salmon: '🐟', egg: '🥚', bread: '🍞', fruit: '🍎' };
    const uploads = snap.docs.slice(0, 3).map(d => {
        const data = d.data();
        const name = data.foodName || 'Meal';
        const emoji = emojis[Object.keys(emojis).find(k => name.toLowerCase().includes(k)) || ''] || '🍽️';
        return { id: d.id, name, calories: data.calories || 0, image: emoji, time: formatUploadTime(data.createdAt?.toDate() || new Date()), ...data };
    });
    return { data: uploads };
};

function formatUploadTime(date: Date): string {
    const now = new Date();
    const time = date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    if (date.toDateString() === now.toDateString()) return `Today, ${time}`;
    return `${date.toLocaleDateString()}, ${time}`;
}

export const getActiveDietPlan = async () => {
    const user = auth.currentUser;
    if (!user) throw new Error('Unauthenticated');

    const planDoc = await getDoc(doc(db, 'diet_recommendations', user.uid));
    if (!planDoc.exists()) return { data: { active: false } };

    const p = planDoc.data();
    const start = p.createdAt?.toDate() || new Date();
    const elapsed = Math.floor((new Date().getTime() - start.getTime()) / 86400000);
    const remaining = Math.max(0, 30 - elapsed);

    let nName = 'AI Generated';
    const uDoc = await getDoc(doc(db, 'users', user.uid));
    const nid = uDoc.data()?.nutritionistId;
    if (nid) {
        const nDoc = await getDoc(doc(db, 'users', nid));
        nName = nDoc.data()?.name || 'Nutritionist';
    }

    return { data: { active: remaining > 0, name: `${p.fitnessGoal || 'Wellness'} Plan`, dailyCalories: p.calories || 2000, progress: Math.min(100, Math.round((elapsed / 30) * 100)), daysRemaining: remaining, macros: { protein: p.protein || 0, carbs: p.carbs || 0, fats: p.fats || 0 }, nutritionist: nName } };
};

export const getDailyIntakeHistory = async () => {
    const user = auth.currentUser;
    if (!user) throw new Error('Unauthenticated');

    const progress = await getDailyProgress(user.uid);
    
    // Group meals by type
    const grouped: any = {
        breakfast: [],
        lunch: [],
        dinner: [],
        snacks: []
    };
    
    progress.meals.forEach((m: any) => {
        const type = m.mealType.toLowerCase();
        if (grouped[type]) grouped[type].push(m);
        else grouped.snacks.push(m);
    });

    const consumed = progress.consumed;
    const goal = progress.goal;
    
    let compliance = 'on-track';
    if (consumed > goal) compliance = 'over';
    else if (consumed < goal * 0.8) compliance = 'under';

    return { 
        data: { 
            today: progress.meals, 
            grouped,
            dailyGoal: goal, 
            consumed, 
            compliance, 
            macros: { 
                protein: progress.totalProtein, 
                carbs: progress.totalCarbs, 
                fats: progress.totalFats 
            } 
        } 
    };
};

// admin apis
export const getAdminStats = async () => {
    const users = await getDocs(collection(db, 'users'));
    const plans = await getDocs(collection(db, 'diet_recommendations'));
    const requests = await getDocs(query(collection(db, 'nutritionist_requests'), where('status', '==', 'pending')));
    const logs = await getDocs(collection(db, 'food_logs'));

    let totalCals = 0;
    logs.forEach(d => totalCals += (d.data().calories || 0));

    return { data: { totalUsers: users.size, totalNutritionists: users.docs.filter(d => d.data().role === 'nutritionist').length, totalFoodLogs: logs.size, activeDietPlans: plans.size, pendingNutritionistRequests: requests.size, systemWideAvgCalories: logs.size > 0 ? Math.round(totalCals / logs.size) : 0 } };
};

export const getAllUsers = async () => {
    const snap = await getDocs(collection(db, 'users'));
    return { data: snap.docs.map(d => ({ id: d.id, ...d.data() })) };
};

export const getUserFoodLogs = async (userId: string, dateRange: 'all' | 'today' | 'week' | 'month' = 'all', pageSize = 25, cursor?: any) => {
    const logsRef = collection(db, 'food_logs');
    const now = new Date();
    let startDate: Date | undefined;

    if (dateRange === 'today') {
        startDate = new Date(now);
        startDate.setHours(0, 0, 0, 0);
    } else if (dateRange === 'week') {
        startDate = new Date(now);
        startDate.setDate(now.getDate() - 6);
        startDate.setHours(0, 0, 0, 0);
    } else if (dateRange === 'month') {
        startDate = new Date(now);
        startDate.setDate(now.getDate() - 29);
        startDate.setHours(0, 0, 0, 0);
    }

    let q;
    if (startDate) {
        q = query(logsRef, where('userId', '==', userId), where('createdAt', '>=', Timestamp.fromDate(startDate)), orderBy('createdAt', 'desc'), limit(pageSize));
    } else {
        q = query(logsRef, where('userId', '==', userId), orderBy('createdAt', 'desc'), limit(pageSize));
    }

    if (cursor) {
        q = query(q, startAfter(cursor));
    }

    const snap = await getDocs(q);
    const logs = snap.docs.map(d => {
        const data = d.data() as any;
        return {
            id: d.id,
            ...data,
            createdAt: data.createdAt?.toDate?.() || new Date(),
        } as any;
    });
    return { data: logs, lastVisible: snap.docs[snap.docs.length - 1] || null, hasMore: snap.size === pageSize };
};

export const manageNutritionist = async (action: string, userId: string) => {
    await updateDoc(doc(db, 'users', userId), { role: action === 'add' ? 'nutritionist' : 'user', updatedAt: serverTimestamp() });
    return { success: true };
};

export const deleteNutritionist = async (id: string) => {
    const batch = writeBatch(db);
    const users = await getDocs(query(collection(db, 'users'), where('nutritionistId', '==', id)));
    users.forEach(d => batch.update(d.ref, { nutritionistId: null }));
    const altUsers = await getDocs(query(collection(db, 'users'), where('assignedNutritionistId', '==', id)));
    altUsers.forEach(d => batch.update(d.ref, { assignedNutritionistId: null }));
    batch.delete(doc(db, 'users', id));
    await batch.commit();
    return { success: true };
};

export const assignRole = async (userId: string, role: string) => {
    await updateDoc(doc(db, 'users', userId), { role, updatedAt: serverTimestamp() });
    return { success: true };
};

export const getAdminFoodItems = async () => {
    const res = await api.get('/admin/food');
    return { data: (res.data || []).map((i: any) => ({ ...i, protein: i.proteins })) };
};

export const createFoodItem = async (data: any) => api.post('/admin/food', { ...data, proteins: data.protein });
export const updateFoodItem = async (id: string, data: any) => api.put(`/admin/food/${id}`, { ...data, proteins: data.protein });
export const deleteFoodItem = async (id: string) => api.delete(`/admin/food/${id}`);
export const getAIModelStatus = () => api.get('/admin/ai/model');
export const triggerRetrain = () => api.post('/admin/ai/retrain');
export const updateSystemSettings = (s: any) => api.put('/admin/settings', s);

export const getFoodLogs = async () => {
    const snap = await getDocs(query(collection(db, 'food_logs'), orderBy('createdAt', 'desc'), limit(50)));
    const cache: any = {};
    const logs = await Promise.all(snap.docs.map(async (d) => {
        const data = d.data();
        if (!cache[data.userId]) {
            const u = await getDoc(doc(db, 'users', data.userId));
            cache[data.userId] = u.exists() ? u.data().name : 'Unknown';
        }
        return { id: d.id, user: cache[data.userId], meal: data.foods?.join(', ') || 'Meal', calories: data.calories || 0, protein: data.protein || 0, carbs: data.carbs || 0, fats: data.fats || 0, date: data.createdAt?.toDate().toLocaleDateString() || '' };
    }));
    return { data: logs };
};

export const getUsersAPI = getAllUsers;

// --- Consolidated Tracking APIs (Firestore JS SDK Only) ---
export const trackMeal = async (data: any) => {
    const { trackMealToFirestore } = await import('./firestore');
    await trackMealToFirestore(
        data.userId,
        data.mealType,
        {
            name: data.food.name,
            kcal: data.food.kcal,
            protein: data.food.p,
            carbs: data.food.c,
            fats: data.food.f
        },
        data.source || 'ai',
        data.portion
    );
    return { success: true };
};

export const getDailyProgress = async (userId: string, date?: string) => {
    const { getDailyTrackingFromFirestore } = await import('./firestore');
    const totals = await getDailyTrackingFromFirestore(userId);
    
    // Get user's calorie goal (explicit goal > calculated AI goal)
    let goal = 2000;
    let proteinGoal = 150;
    let carbsGoal = 200;
    let fatsGoal = 65;

    const uDoc = await getDoc(doc(db, 'users', userId));
    if (uDoc.exists()) {
        const d = uDoc.data();
        goal = d.dailyCalorieGoal || calculateDynamicCalories(d);
        proteinGoal = d.proteinGoal || Math.round(goal * 0.3 / 4);
        carbsGoal = d.carbsGoal || Math.round(goal * 0.4 / 4);
        fatsGoal = d.fatsGoal || Math.round(goal * 0.3 / 9);
    }
    
    const consumed = totals.totalCalories;
    const remaining = Math.max(0, goal - consumed);
    
    return {
        ...totals,
        consumed: Math.round(consumed),
        goal: Math.round(goal),
        proteinGoal,
        carbsGoal,
        fatsGoal,
        remaining: Math.round(remaining)
    };
};

export default api;
