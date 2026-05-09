import React from 'react';
import Card from '../atoms/Card';

interface Recommendation {
    mealType: string;
    title: string;
    calories: number;
    targetMatch: string;
    healthTip: string;
}

interface RecommendationCardProps {
    recommendation: Recommendation;
}

const RecommendationCard: React.FC<RecommendationCardProps> = ({ recommendation }) => {
    return (
        <Card className="hover:shadow-lg transition-shadow duration-300">
            <div className="p-5">
                <div className="flex justify-between items-start mb-3">
                    <div>
                        <span className="text-xs font-bold uppercase tracking-wider text-emerald-600 bg-emerald-50 px-2 py-1 rounded-md">
                            {recommendation.mealType}
                        </span>
                        <h3 className="text-lg font-bold text-slate-800 mt-2">{recommendation.title}</h3>
                    </div>
                    <span className="text-base font-black text-slate-700 bg-slate-100 px-3 py-1 rounded-full">
                        {recommendation.calories} kcal
                    </span>
                </div>

                <div className="space-y-3 mt-4">
                    <div>
                        <p className="text-xs font-semibold text-slate-400 uppercase">Target Match</p>
                        <p className="text-sm font-medium text-slate-700">{recommendation.targetMatch}</p>
                    </div>

                    <div className="bg-emerald-50/50 p-3 rounded-lg border border-emerald-100">
                        <div className="flex gap-2">
                            <span className="text-emerald-500">💡</span>
                            <p className="text-xs text-emerald-800 font-medium my-auto leading-relaxed">
                                {recommendation.healthTip}
                            </p>
                        </div>
                    </div>
                </div>
            </div>
        </Card>
    );
};

export default RecommendationCard;
