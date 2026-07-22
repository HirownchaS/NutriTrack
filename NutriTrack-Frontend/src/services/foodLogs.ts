import { trackMealToFirestore, getTodayFoodLogs } from './firestore';
import { auth } from '../firebase/config';

export const addManualFoodLog = async (data: any) => {
  const user = auth.currentUser;
  if (!user) throw new Error('Unauthenticated');

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

export const getFoodLogs = async () => {
  return null as any; // kept for compatibility; use admin.getUserFoodLogs or other helpers as needed
};
