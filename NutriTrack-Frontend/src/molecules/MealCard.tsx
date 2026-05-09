import React from 'react';
import Card from '../atoms/Card';
import Badge from '../atoms/Badge';
import { FiZap, FiTarget, FiActivity } from 'react-icons/fi';


interface MealCardProps {
    name: string;
    kcal: number;
    p: number;
    c: number;
    f: number;
    desc?: string;
}

const MealCard: React.FC<MealCardProps> = ({ name, kcal, p, c, f, desc }) => {
    return (
        <Card className="flex flex-col h-full hover:shadow-lg transition-all duration-300 border border-slate-100 group">
            <div className="p-5 flex flex-col h-full">
                {/* Header: Name and Calorie Badge */}
                <div className="flex justify-between items-start gap-4 mb-3">
                    <h3 className="text-lg font-bold text-slate-800 leading-tight group-hover:text-emerald-700 transition-colors">
                        {name}
                    </h3>
                    <Badge color="blue" className="flex-shrink-0">
                        {kcal} kcal
                    </Badge>
                </div>

                {/* Description */}
                <p className="text-sm text-slate-500 font-medium mb-6 line-clamp-2 italic">
                   
                </p>

                {/* Nutritional Benchmarks (Macros) */}
                <div className="mt-auto">
                    <div className="grid grid-cols-3 gap-2 mb-4">
                        <div className="flex flex-col items-center p-2 bg-emerald-50 rounded-xl border border-emerald-100">
                            <span className="text-[10px] uppercase font-black text-emerald-600 tracking-wider mb-1 flex items-center gap-1">
                                <FiZap className="w-2 h-2" /> P
                            </span>
                            <span className="text-sm font-bold text-slate-700">{p}g</span>
                        </div>
                        <div className="flex flex-col items-center p-2 bg-blue-50 rounded-xl border border-blue-100">
                            <span className="text-[10px] uppercase font-black text-blue-600 tracking-wider mb-1 flex items-center gap-1">
                                <FiTarget className="w-2 h-2" /> C
                            </span>
                            <span className="text-sm font-bold text-slate-700">{c}g</span>
                        </div>
                        <div className="flex flex-col items-center p-2 bg-orange-50 rounded-xl border border-orange-100">
                            <span className="text-[10px] uppercase font-black text-orange-600 tracking-wider mb-1 flex items-center gap-1">
                                <FiActivity className="w-2 h-2" /> F
                            </span>
                            <span className="text-sm font-bold text-slate-700">{f}g</span>
                        </div>
                    </div>

                    <button
                        onClick={async () => {
                            const { auth } = await import('../firebase/config');
                            const { trackMeal } = await import('../services/api');
                            const user = auth.currentUser;
                            if (!user) return;

                            const mealType = name.split(':')[0].toLowerCase() || 'snacks';
                            try {
                                await trackMeal({
                                    userId: user.uid,
                                    date: new Date().toISOString().split('T')[0],
                                    mealType,
                                    food: { name, kcal, p, c, f },
                                    source: 'ai'
                                });
                                alert(`Success: ${name} has been logged to your daily intake.`);
                            } catch (err) {
                                console.error(err);
                                alert('Failed to log meal. Please try again.');
                            }
                        }}
                        className="w-full py-3 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-bold text-sm transition-colors shadow-lg shadow-emerald-600/20 flex items-center justify-center gap-2"
                    >
                        Eat This Meal
                    </button>
                </div>
            </div>
        </Card>
    );
};

export default MealCard;
