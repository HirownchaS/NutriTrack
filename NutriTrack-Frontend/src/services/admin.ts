import api from './api';
import { db } from '../firebase/config';
import { collection, getDocs, query, where, orderBy, limit, writeBatch, doc, updateDoc, Timestamp, startAfter, serverTimestamp } from 'firebase/firestore';

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
