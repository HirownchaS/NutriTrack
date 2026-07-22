import { db, auth } from '../firebase/config';
import { collection, query, where, getDocs, doc, getDoc, updateDoc, setDoc, serverTimestamp, limit, orderBy } from 'firebase/firestore';
import { addNotification } from './firestore';

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
      const logs = await getDocs(query(collection(db, 'food_logs'), where('userId', 'in', uids.slice(0, 10)), orderBy('createdAt', 'desc'), limit(5)));
      for (const l of logs.docs) {
        const ld = l.data();
        const uDoc = await getDoc(doc(db, 'users', ld.userId));
        activity.push({ id: l.id, type: 'food_log', user: uDoc.data()?.name || 'User', action: `logged ${ld.foodName || 'a meal'} (${ld.calories || 0} kcal)`, time: ld.createdAt ? getRelativeTime(ld.createdAt.toDate()) : 'recently', icon: '📸' });
      }
    } catch { }
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
