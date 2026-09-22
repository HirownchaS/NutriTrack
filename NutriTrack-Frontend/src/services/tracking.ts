import { db } from "../firebase/config";
import {
  collection,
  query,
  where,
  getDocs,
  addDoc,
  doc,
  updateDoc,
  serverTimestamp,
  getDoc,
  orderBy,
  Timestamp,
  limit,
  writeBatch,
  startAfter,
} from "firebase/firestore";
import {
  trackMealToFirestore,
  getDailyTrackingFromFirestore,
} from "./firestore";

export const calculateDynamicCalories = (userProfile: any): number => {
  if (!userProfile) return 2000;
  const {
    weight = 70,
    height = 170,
    age = 30,
    gender = "male",
    activityLevel = "moderate",
    fitnessGoal = "maintain",
  } = userProfile;

  let bmr =
    10 * weight +
    6.25 * height -
    5 * age +
    (gender.toLowerCase() === "male" ? 5 : -161);
  const multipliers: any = {
    light: 1.375,
    moderate: 1.55,
    active: 1.725,
    extreme: 1.9,
  };
  const activeKey =
    Object.keys(multipliers).find((k) =>
      activityLevel.toLowerCase().includes(k),
    ) || "moderate";
  let tdee = bmr * multipliers[activeKey];

  if (fitnessGoal.toLowerCase().includes("lose")) tdee -= 500;
  else if (
    fitnessGoal.toLowerCase().includes("build") ||
    fitnessGoal.toLowerCase().includes("gain")
  )
    tdee += 300;
  if ((userProfile.healthCondition || "").toLowerCase().includes("thyroid"))
    tdee -= 100;

  return Math.max(1200, Math.round(tdee));
};

export const trackMeal = async (data: any) => {
  await trackMealToFirestore(
    data.userId,
    data.mealType,
    {
      name: data.food.name,
      kcal: data.food.kcal,
      protein: data.food.p,
      carbs: data.food.c,
      fats: data.food.f,
    },
    data.source || "ai",
    data.portion,
  );
  return { success: true };
};

export const getDailyProgress = async (userId: string, date?: string) => {
  const totals = await getDailyTrackingFromFirestore(userId);

  let goal = 2000;
  let proteinGoal = 150;
  let carbsGoal = 200;
  let fatsGoal = 65;

  const uDoc = await getDoc(doc(db, "users", userId));
  if (uDoc.exists()) {
    const d = uDoc.data();
    goal = d.dailyCalorieGoal || calculateDynamicCalories(d);
    proteinGoal = d.proteinGoal || Math.round((goal * 0.3) / 4);
    carbsGoal = d.carbsGoal || Math.round((goal * 0.4) / 4);
    fatsGoal = d.fatsGoal || Math.round((goal * 0.3) / 9);
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
    remaining: Math.round(remaining),
  };
};
