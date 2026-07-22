import { db } from '../firebase/config';
import { collection, query, where, getDocs, orderBy, Timestamp, getDoc, doc } from 'firebase/firestore';
import { calculateDynamicCalories } from './tracking';

export const getProgress = async (period: 'daily' | 'weekly' | 'monthly' = 'daily') => {
  const user = (await import('../firebase/config')).auth.currentUser;
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
