import { db } from "../firebase/config";
import {
  collection,
  query,
  where,
  getDocs,
  orderBy,
  limit,
  getDoc,
  doc,
} from "firebase/firestore";
import { getDailyProgress } from "./tracking";

export const getRecentFoodUploads = async () => {
  const user = (await import("../firebase/config")).auth.currentUser;
  if (!user) throw new Error("Unauthenticated");

  const logsRef = collection(db, "food_logs");
  let snap;
  try {
    snap = await getDocs(
      query(
        logsRef,
        where("userId", "==", user.uid),
        orderBy("createdAt", "desc"),
        limit(3),
      ),
    );
  } catch {
    snap = await getDocs(query(logsRef, where("userId", "==", user.uid)));
  }

  const emojis: any = {
    rice: "🍚",
    chicken: "🍗",
    salad: "🥗",
    salmon: "🐟",
    egg: "🥚",
    bread: "🍞",
    fruit: "🍎",
  };
  const uploads = snap.docs.slice(0, 3).map((d) => {
    const data = d.data();
    const name = data.foodName || "Meal";
    const emoji =
      emojis[
        Object.keys(emojis).find((k) => name.toLowerCase().includes(k)) || ""
      ] || "🍽️";
    return {
      id: d.id,
      name,
      calories: data.calories || 0,
      image: emoji,
      time: formatUploadTime(data.createdAt?.toDate() || new Date()),
      ...data,
    };
  });
  return { data: uploads };
};

function formatUploadTime(date: Date): string {
  const now = new Date();
  const time = date.toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
  });
  if (date.toDateString() === now.toDateString()) return `Today, ${time}`;
  return `${date.toLocaleDateString()}, ${time}`;
}

export const getActiveDietPlan = async () => {
  const user = (await import("../firebase/config")).auth.currentUser;
  if (!user) throw new Error("Unauthenticated");

  const planDoc = await getDoc(doc(db, "diet_recommendations", user.uid));
  if (!planDoc.exists()) return { data: { active: false } };

  const p = planDoc.data();
  const start = p.createdAt?.toDate() || new Date();
  const elapsed = Math.floor(
    (new Date().getTime() - start.getTime()) / 86400000,
  );
  const remaining = Math.max(0, 30 - elapsed);

  let nName = "AI Generated";
  const uDoc = await getDoc(doc(db, "users", user.uid));
  const nid = uDoc.data()?.nutritionistId;
  if (nid) {
    const nDoc = await getDoc(doc(db, "users", nid));
    nName = nDoc.data()?.name || "Nutritionist";
  }

  return {
    data: {
      active: remaining > 0,
      name: `${p.fitnessGoal || "Wellness"} Plan`,
      dailyCalories: p.calories || 2000,
      progress: Math.min(100, Math.round((elapsed / 30) * 100)),
      daysRemaining: remaining,
      macros: {
        protein: p.protein || 0,
        carbs: p.carbs || 0,
        fats: p.fats || 0,
      },
      nutritionist: nName,
    },
  };
};

export const getDailyIntakeHistory = async () => {
  const user = (await import("../firebase/config")).auth.currentUser;
  if (!user) throw new Error("Unauthenticated");

  const progress = await getDailyProgress(user.uid);

  const grouped: any = {
    breakfast: [],
    lunch: [],
    dinner: [],
    snacks: [],
  };

  progress.meals.forEach((m: any) => {
    const type = m.mealType.toLowerCase();
    if (grouped[type]) grouped[type].push(m);
    else grouped.snacks.push(m);
  });

  const consumed = progress.consumed;
  const goal = progress.goal;

  let compliance = "on-track";
  if (consumed > goal) compliance = "over";
  else if (consumed < goal * 0.8) compliance = "under";

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
        fats: progress.totalFats,
      },
    },
  };
};
