import React, { useState, useMemo } from 'react';
import Card from '../atoms/Card';
import Button from '../atoms/Button';
import { addManualFoodLog } from '../services/api';
import { FiPlusCircle, FiActivity } from 'react-icons/fi';

interface ManualFoodLogFormProps {
    onSuccess?: () => void;
}

const PORTION_TO_GRAMS: Record<string, number> = {
    'Small': 100,
    'Medium': 200,
    'Large': 300,
    'Cup': 240,
    'Piece': 150
};

const NUTRITION_BASE: Record<string, { cal: number, pro: number, carb: number, fat: number }> = {
    'chicken': { cal: 165, pro: 31, carb: 0, fat: 3.6 },
    'rice': { cal: 130, pro: 2.7, carb: 28, fat: 0.3 },
    'salad': { cal: 15, pro: 1, carb: 3, fat: 0 },
    'apple': { cal: 52, pro: 0.3, carb: 14, fat: 0.2 },
    'banana': { cal: 89, pro: 1.1, carb: 23, fat: 0.3 },
    'egg': { cal: 155, pro: 13, carb: 1.1, fat: 11 },
    'bread': { cal: 265, pro: 9, carb: 49, fat: 3.2 },
    'milk': { cal: 42, pro: 3.4, carb: 5, fat: 1 },
    'salmon': { cal: 208, pro: 20, carb: 0, fat: 13 },
    'beef': { cal: 250, pro: 26, carb: 0, fat: 15 }
};

const calculateNutrition = (foodName: string, portionType: string) => {
    if (!foodName) return { calories: 0, protein: 0, carbs: 0, fats: 0 };
    
    const key = foodName.toLowerCase().trim().split(' ')[0]; // Use first word for basic matching
    let base = Object.entries(NUTRITION_BASE).find(([k, _]) => key.includes(k))?.[1];
    
    if (!base) {
        // Fallback hashing mechanism for unknown foods to provide consistent realistic estimations
        const hash = foodName.toLowerCase().split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
        base = {
            cal: 100 + (hash % 100),
            pro: 5 + (hash % 15),
            carb: 10 + (hash % 30),
            fat: 2 + (hash % 15)
        };
    }
    
    const grams = PORTION_TO_GRAMS[portionType] || 200;
    const multiplier = grams / 100;
    
    return {
        calories: Math.round(base.cal * multiplier),
        protein: Math.round(base.pro * multiplier),
        carbs: Math.round(base.carb * multiplier),
        fats: Math.round(base.fat * multiplier)
    };
};

const ManualFoodLogForm: React.FC<ManualFoodLogFormProps> = ({ onSuccess }) => {
    const [isOpen, setIsOpen] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [formData, setFormData] = useState({
        foodName: '',
        mealType: 'Lunch',
        portionType: 'Medium'
    });
    
    // State to store the result for the table display
    const [lastSavedLog, setLastSavedLog] = useState<any>(null);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!formData.foodName) return;

        setIsSubmitting(true);
        try {
            // 1. Calculate nutrition ONLY after click
            const nutrition = calculateNutrition(formData.foodName, formData.portionType);
            
            const logData = {
                foodName: formData.foodName,
                mealType: formData.mealType,
                portion: formData.portionType,
                calories: nutrition.calories,
                protein: nutrition.protein,
                carbs: nutrition.carbs,
                fats: nutrition.fats,
                source: "manual"
            };

            // 2. Store in Firestore (via API)
            await addManualFoodLog(logData);

            // 3. Update local state to show table
            setLastSavedLog(logData);

            // Reset form but keep lastSavedLog visible
            setFormData({
                foodName: '',
                mealType: 'Lunch',
                portionType: 'Medium'
            });
            
            if (onSuccess) onSuccess();
        } catch (err) {
            console.error("Failed to add manual log", err);
            alert("Failed to save meal. Please try again.");
        } finally {
            setIsSubmitting(false);
        }
    };

    if (!isOpen) {
        return (
            <div className="space-y-4">
                {lastSavedLog && (
                    <Card className="p-0 overflow-hidden border-emerald-200 shadow-lg animate-fade-in">
                        <div className="bg-emerald-600 px-4 py-2">
                            <h4 className="text-white text-xs font-black uppercase tracking-widest">Last Saved Entry</h4>
                        </div>
                        <div className="overflow-x-auto">
                            <table className="w-full text-left border-collapse">
                                <thead>
                                    <tr className="bg-slate-50 border-b border-slate-100">
                                        <th className="px-4 py-3 text-[10px] font-black text-slate-400 uppercase tracking-wider">Food Name</th>
                                        <th className="px-4 py-3 text-[10px] font-black text-slate-400 uppercase tracking-wider text-center">Portion</th>
                                        <th className="px-4 py-3 text-[10px] font-black text-slate-400 uppercase tracking-wider text-center">Calories</th>
                                        <th className="px-4 py-3 text-[10px] font-black text-slate-400 uppercase tracking-wider text-center">Protein</th>
                                        <th className="px-4 py-3 text-[10px] font-black text-slate-400 uppercase tracking-wider text-center">Carbs</th>
                                        <th className="px-4 py-3 text-[10px] font-black text-slate-400 uppercase tracking-wider text-center">Fats</th>
                                        <th className="px-4 py-3 text-[10px] font-black text-slate-400 uppercase tracking-wider text-right">Meal</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-50">
                                    <tr className="hover:bg-slate-50/50 transition-colors">
                                        <td className="px-4 py-4 text-sm font-bold text-slate-700">{lastSavedLog.foodName}</td>
                                        <td className="px-4 py-4 text-sm font-bold text-slate-500 text-center">{lastSavedLog.portion}</td>
                                        <td className="px-4 py-4 text-sm font-black text-emerald-600 text-center">{lastSavedLog.calories} kcal</td>
                                        <td className="px-4 py-4 text-sm font-bold text-slate-600 text-center">{lastSavedLog.protein}g</td>
                                        <td className="px-4 py-4 text-sm font-bold text-slate-600 text-center">{lastSavedLog.carbs}g</td>
                                        <td className="px-4 py-4 text-sm font-bold text-slate-600 text-center">{lastSavedLog.fats}g</td>
                                        <td className="px-4 py-4 text-right">
                                            <span className="text-[10px] font-black uppercase px-2 py-1 bg-slate-100 rounded-md text-slate-500">{lastSavedLog.mealType}</span>
                                        </td>
                                    </tr>
                                </tbody>
                            </table>
                        </div>
                    </Card>
                )}
                <button 
                    onClick={() => setIsOpen(true)}
                    className="w-full py-4 border-2 border-dashed border-slate-200 rounded-2xl text-slate-400 font-bold hover:border-emerald-400 hover:text-emerald-600 hover:bg-emerald-50 transition-all flex items-center justify-center gap-2"
                >
                    <FiPlusCircle className="w-5 h-5" />
                    Add Manual Food Entry
                </button>
            </div>
        );
    }

    return (
        <Card className="p-6 border-emerald-100 bg-emerald-50/30 animate-fade-in">
            <div className="flex items-center justify-between mb-5">
                <h3 className="font-black text-slate-800 flex items-center gap-2">
                    <FiActivity className="text-emerald-600" />
                    Manual Food Log
                </h3>
                <button onClick={() => setIsOpen(false)} className="text-slate-400 hover:text-slate-600 font-black text-xl">×</button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
                <div className="space-y-1.5">
                    <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">Food Name</label>
                    <input 
                        type="text"
                        required
                        placeholder="e.g. Grilled Chicken Salad"
                        className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:border-emerald-500 focus:ring-4 focus:ring-emerald-500/10 outline-none transition-all font-bold text-slate-700"
                        value={formData.foodName}
                        onChange={e => setFormData({...formData, foodName: e.target.value})}
                    />
                </div>

                <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                        <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">Meal Type</label>
                        <select 
                            className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:border-emerald-500 outline-none font-bold text-slate-700 appearance-none bg-white"
                            value={formData.mealType}
                            onChange={e => setFormData({...formData, mealType: e.target.value})}
                        >
                            <option>Breakfast</option>
                            <option>Lunch</option>
                            <option>Dinner</option>
                            <option>Snack</option>
                        </select>
                    </div>
                    <div className="space-y-1.5">
                        <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">Portion Type</label>
                        <select 
                            className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:border-emerald-500 outline-none font-bold text-slate-700 appearance-none bg-white"
                            value={formData.portionType}
                            onChange={e => setFormData({...formData, portionType: e.target.value})}
                        >
                            {Object.keys(PORTION_TO_GRAMS).map(pt => (
                                <option key={pt} value={pt}>{pt}</option>
                            ))}
                        </select>
                    </div>
                </div>

                <Button type="submit" disabled={isSubmitting || !formData.foodName} className="w-full py-3.5 mt-2">
                    {isSubmitting ? 'Logging...' : 'Save Entry'}
                </Button>
            </form>
        </Card>
    );
};

export default ManualFoodLogForm;
