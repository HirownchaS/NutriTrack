import React, { useState, useEffect } from 'react';
import Card from '../atoms/Card';
import { getNutritionSummary } from '../services/profile';
import { getDailyProgress } from '../services/tracking';
import { auth } from '../firebase/config';


interface NutritionData {
    totalCalories: number;
    protein: number;
    carbs: number;
    fats: number;
}

interface NutritionSummaryProps {
    overrideData?: NutritionData | null;
}

const NutritionSummary: React.FC<NutritionSummaryProps> = ({ overrideData }) => {
    const [summary, setSummary] = useState<NutritionData | null>(null);

    useEffect(() => {
        const fetchSummary = async () => {
            const user = auth.currentUser;
            if (!user) return;

            try {
                const res = await getDailyProgress(user.uid);
                setSummary({
                    totalCalories: Math.round(res.totalCalories),
                    protein: Number(res.totalProtein.toFixed(1)),
                    carbs: Number(res.totalCarbs.toFixed(1)),
                    fats: Number(res.totalFats.toFixed(1))
                });
            } catch (err) {
                console.error('Failed to fetch daily progress', err);
            }
        };
        fetchSummary();
    }, []);

    // Allow parent to override data (e.g. after new food upload)
    const data = overrideData || summary;

    if (!data) return null;

    const cards = [
        { label: 'Total Calories', value: `${data.totalCalories}`, unit: 'kcal', icon: '🔥', color: 'from-orange-400 to-red-500', bg: 'bg-orange-50' },
        { label: 'Protein', value: `${data.protein}`, unit: 'g', icon: '🥩', color: 'from-emerald-400 to-teal-500', bg: 'bg-emerald-50' },
        { label: 'Carbs', value: `${data.carbs}`, unit: 'g', icon: '🍞', color: 'from-blue-400 to-indigo-500', bg: 'bg-blue-50' },
        { label: 'Fats', value: `${data.fats}`, unit: 'g', icon: '🥑', color: 'from-amber-400 to-yellow-500', bg: 'bg-amber-50' },
    ];

    return (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4" role="region" aria-label="Nutritional summary">
            {cards.map((card) => (
                <Card key={card.label} className="p-5 hover:-translate-y-1 transition-transform duration-300">
                    <div className="flex items-start justify-between mb-3">
                        <div className={`w-10 h-10 ${card.bg} rounded-xl flex items-center justify-center text-xl`} aria-hidden="true">
                            {card.icon}
                        </div>
                    </div>
                    <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">{card.label}</p>
                    <p className="text-2xl font-black text-slate-800 mt-1">
                        {card.value}
                        <span className="text-sm font-medium text-slate-400 ml-1">{card.unit}</span>
                    </p>
                </Card>
            ))}
        </div>
    );
};

export default NutritionSummary;
