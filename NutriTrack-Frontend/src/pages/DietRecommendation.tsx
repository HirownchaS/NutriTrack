import React, { useState, useEffect } from 'react';
import { getDietRecommendation } from '../services/api';
import Card from '../atoms/Card';
import Badge from '../atoms/Badge';
import MealCard from '../molecules/MealCard';
import { FiCoffee, FiSun, FiMoon, FiPieChart, FiTrendingUp, FiCheckCircle, FiInfo } from 'react-icons/fi';



interface MealSuggestion {
    name: string;
    kcal: number;
    p: number;
    c: number;
    f: number;
    desc: string;
}

interface DietData {
    goal: string;
    calories: number;
    protein: number;
    carbs: number;
    fats: number;
    mealPlan: string;
    suggestions: MealSuggestion[];
}

const DietRecommendation: React.FC = () => {
    const [data, setData] = useState<DietData | null>(null);
    const [isLoading, setIsLoading] = useState<boolean>(true);
    const [error, setError] = useState<string>('');

    useEffect(() => {
        fetchRecommendation();
    }, []);

    const fetchRecommendation = async () => {
        setIsLoading(true);
        setError('');
        try {
            const result = await getDietRecommendation();
            setData(result);
        } catch (err) {
            setError('Failed to load diet recommendations. Please ensure your profile is complete.');
        } finally {
            setIsLoading(false);
        }
    };

    if (isLoading) {
        return (
            <div className="p-8 flex flex-col items-center justify-center min-h-[400px]">
                <div className="w-16 h-16 border-4 border-emerald-100 border-t-emerald-600 rounded-full animate-spin mb-6"></div>
                <p className="text-slate-500 font-bold animate-pulse text-lg">AI is analyzing your profile...</p>
            </div>
        );
    }

    if (error || !data) {
        return (
            <div className="p-8 text-center max-w-md mx-auto">
                <div className="p-6 bg-rose-50 text-rose-600 rounded-3xl mb-6 border border-rose-100 shadow-sm">
                    <FiInfo className="w-8 h-8 mx-auto mb-3 opacity-50" />
                    <p className="font-bold">{error || 'No recommendations found.'}</p>
                </div>
                <button
                    onClick={fetchRecommendation}
                    className="bg-emerald-600 text-white px-8 py-3 rounded-2xl font-black shadow-lg shadow-emerald-600/20 hover:scale-105 transition-all"
                >
                    Retry Analysis
                </button>
            </div>
        );
    }

    return (
        <div className="p-6 max-w-5xl mx-auto space-y-10 animate-fade-in">
            {/* page header */}
            <header className="flex flex-col md:flex-row md:items-end justify-between gap-4">
                <div>
                    <h1 className="text-4xl font-black text-slate-800 tracking-tight leading-none">AI Diet Plan</h1>
                    <p className="mt-3 text-slate-500 font-medium">Customized for your <span className="text-emerald-600 font-bold">"{data.goal}"</span> goal</p>
                </div>
        
            </header>

            {/* Summary Card: Daily Targets */}
            <Card className="p-10 bg-slate-900 border-0 shadow-3xl relative overflow-hidden ring-1 ring-white/10">
                <div className="absolute top-0 right-0 -translate-y-1/2 translate-x-1/2 w-96 h-96 bg-emerald-500 rounded-full opacity-10 filter blur-3xl"></div>

                <div className="relative z-10 grid grid-cols-1 lg:grid-cols-12 gap-12">
                    {/* Total Kcal */}
                    <div className="lg:col-span-4 flex flex-col justify-center items-center lg:items-start text-center lg:text-left lg:border-r border-slate-800 pr-0 lg:pr-12">
                        <p className="text-emerald-400 text-xs font-black uppercase tracking-[0.3em] mb-4">Daily Energy Target</p>
                        <div className="flex items-baseline gap-2">
                            <span className="text-7xl font-black text-black">{data.calories}</span>
                            <span className="text-slate-400 text-xl font-bold">kcal</span>
                        </div>
                        <p className="text-slate-500 text-sm mt-4 font-medium leading-relaxed">
                            Calculated based on your TDEE and activity levels.
                        </p>
                    </div>

                    {/* Macros Grid */}
                    <div className="lg:col-span-8 grid grid-cols-1 sm:grid-cols-3 gap-6">
                        {[
                            { label: 'Protein', value: data.protein, color: 'text-emerald-400', bg: 'bg-emerald-400/10', border: 'border-emerald-400/20', sub: 'Muscle Repair' },
                            { label: 'Carbs', value: data.carbs, color: 'text-blue-400', bg: 'bg-blue-400/10', border: 'border-blue-400/20', sub: 'Energy Source' },
                            { label: 'Fats', value: data.fats, color: 'text-orange-400', bg: 'bg-orange-400/10', border: 'border-orange-400/20', sub: 'Brain Health' }
                        ].map((macro, i) => (
                            <div key={i} className={`${macro.bg} backdrop-blur-md p-6 rounded-3xl border ${macro.border} flex flex-col items-center justify-center group hover:scale-105 transition-all duration-300`}>
                                <span className={`text-3xl font-black ${macro.color}`}>{macro.value}g</span>
                                <span className="text-black text-[11px] font-black uppercase tracking-[0.2em] mt-2 opacity-80">{macro.label}</span>
                                <span className="text-slate-500 text-[10px] mt-2 font-bold">{macro.sub}</span>
                            </div>
                        ))}
                    </div>
                </div>
            </Card>

            {/* Recommendation Plan Card */}
            <div className="grid grid-cols-1 gap-8">
                <Card className="p-8 border-slate-100 bg-white shadow-xl shadow-slate-200/50">
                    <div className="flex items-start gap-5">
                        <div className="w-14 h-14 rounded-2xl bg-emerald-100 flex items-center justify-center text-emerald-600 flex-shrink-0">
                            <FiTrendingUp className="w-7 h-7" />
                        </div>
                        <div>
                            <h2 className="text-2xl font-black text-slate-800 tracking-tight">Your Personalized Strategy</h2>
                            <p className="text-slate-500 font-medium mt-1 uppercase text-xs tracking-widest">AI Generated Insight</p>

                            <div className="mt-6 p-6 bg-slate-50 rounded-2xl border border-slate-100 leading-relaxed text-slate-700 font-semibold italic">
                                "{data.mealPlan}"
                            </div>

                            <p className="mt-6 text-slate-500 text-sm leading-relaxed decoration-emerald-100 prose">
                                This recommendation is generated using a Decision Tree model trained on your unique physiological markers.
                                It focuses on maintaining metabolic health while steering you toward your <span className="text-emerald-600 font-bold italic">{data.goal.toLowerCase()}</span> goal.
                            </p>
                        </div>
                    </div>
                </Card>
            </div>

            {/* Meal Suggestions Section */}
            <section className="space-y-6">
                <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-blue-100 flex items-center justify-center text-blue-600">
                        <FiCoffee className="w-5 h-5" />
                    </div>
                    <div>
                        <h2 className="text-2xl font-black text-slate-800 tracking-tight">Recommended Daily Meals</h2>
                        <p className="text-slate-400 text-xs font-bold uppercase tracking-widest">Goal-optimized choices</p>
                    </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    {data.suggestions?.map((meal, idx) => (
                        <MealCard
                            key={idx}
                            name={meal.name}
                            kcal={meal.kcal}
                            p={meal.p}
                            c={meal.c}
                            f={meal.f}
                            // desc={meal.desc}
                        />
                    ))}
                </div>
            </section>

            
            
        </div>
    );
};

export default DietRecommendation;
