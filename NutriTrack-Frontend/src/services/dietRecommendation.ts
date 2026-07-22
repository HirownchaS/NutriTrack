import api from './api';
import { db } from '../firebase/config';
import { setDoc, doc, serverTimestamp, getDoc } from 'firebase/firestore';

export const getDietRecommendation = async () => {
  const user = (await import('../firebase/config')).auth.currentUser;
  if (!user) throw new Error("Unauthenticated");

  const uDoc = await getDoc(doc(db, 'users', user.uid));
  const u = uDoc.data() || {};

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

export const createDietPlan = async (userId: string, data: any) => {
  const user = (await import('../firebase/config')).auth.currentUser;
  if (!user) throw new Error("Unauthenticated");
  await setDoc(doc(db, 'diet_recommendations', userId), { ...data, userId, nutritionistId: user.uid, updatedAt: serverTimestamp() }, { merge: true });
  return { success: true };
};
