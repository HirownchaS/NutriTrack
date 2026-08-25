import { db, auth } from "../firebase/config";
import { doc, updateDoc, getDoc } from "firebase/firestore";
import { getTodayFoodLogs } from "./firestore";

export const setGoals = async (goals: any) => {
  const user = auth.currentUser;
  if (!user) throw new Error("Unauthenticated");
  await updateDoc(doc(db, "users", user.uid), {
    dailyCalorieGoal: goals.calories,
    proteinGoal: goals.protein,
    carbsGoal: goals.carbs,
    fatsGoal: goals.fats,
    updatedAt: new Date(),
  });
  return { success: true };
};

export const getNutritionSummary = async () => {
  const user = auth.currentUser;
  if (!user) throw new Error("Unauthenticated");

  const logs = await getTodayFoodLogs(user.uid);
  const totals = logs.reduce(
    (acc, log) => ({
      calories: acc.calories + (log.calories || 0),
      protein: acc.protein + (log.protein || 0),
      carbs: acc.carbs + (log.carbs || 0),
      fats: acc.fats + (log.fats || 0),
    }),
    { calories: 0, protein: 0, carbs: 0, fats: 0 },
  );

  return {
    data: {
      totalCalories: Math.round(totals.calories),
      protein: Number(totals.protein.toFixed(1)),
      carbs: Number(totals.carbs.toFixed(1)),
      fats: Number(totals.fats.toFixed(1)),
    },
  };
};
