import React, { useState } from 'react';
import Card from '../atoms/Card';
import Badge from '../atoms/Badge';
import NutritionCard from './NutritionCard';
import NutritionChart from './NutritionChart';
import { FiCheckCircle, FiAlertTriangle, FiChevronDown, FiChevronUp } from 'react-icons/fi';
import type { Detection, NutritionSummaryData } from '../types/nutrition';



interface ResultCardProps {
    detections: Detection[];
    nutrition?: NutritionSummaryData;
}

const ResultCard: React.FC<ResultCardProps> = ({ detections, nutrition }) => {
    const [expanded, setExpanded] = useState(true);

    if (detections.length === 0) {
        return (
            <Card className="p-6">
                <div className="flex flex-col items-center gap-3 py-6 text-center">
                    <div className="w-14 h-14 bg-slate-100 rounded-2xl flex items-center justify-center">
                        <FiAlertTriangle className="w-7 h-7 text-slate-400" />
                    </div>
                    <div>
                        <p className="text-sm font-bold text-slate-600">No Foods Detected</p>
                        <p className="text-xs text-slate-400 mt-1">
                            Try uploading a clearer image with visible food items.
                        </p>
                    </div>
                </div>
            </Card>
        );
    }

    // Compute nutrition from detections if not passed from parent
    const totals: NutritionSummaryData = nutrition ?? {
        totalCalories: detections.reduce((s, d) => s + (d.calories ?? 0), 0),
        totalProtein: detections.reduce((s, d) => s + (d.protein ?? 0), 0),
        totalCarbs: detections.reduce((s, d) => s + (d.carbs ?? 0), 0),
        totalFat: detections.reduce((s, d) => s + (d.fat ?? 0), 0),
        totalFiber: detections.reduce((s, d) => s + (d.fiber ?? 0), 0),
    };

    return (
        <div className="space-y-4">
            {/* Main header card */}
            <Card className="overflow-hidden">
                {/* Header */}
                <div className="px-6 py-4 bg-gradient-to-r from-emerald-50 to-teal-50 border-b border-emerald-100">
                    <div className="flex items-center justify-between">
                        <h3 className="text-sm font-bold text-slate-700 uppercase tracking-wider flex items-center gap-2">
                            <FiCheckCircle className="w-4 h-4 text-emerald-600" />
                            Detected Foods
                        </h3>
                        <div className="flex items-center gap-3">
                            <Badge color="green">
                                {detections.length} item{detections.length !== 1 ? 's' : ''} found
                            </Badge>
                            <button
                                onClick={() => setExpanded(!expanded)}
                                className="text-slate-400 hover:text-slate-600 transition-colors"
                                aria-label={expanded ? 'Collapse details' : 'Expand details'}
                            >
                                {expanded ? <FiChevronUp className="w-4 h-4" /> : <FiChevronDown className="w-4 h-4" />}
                            </button>
                        </div>
                    </div>
                </div>

                {/* Quick summary row */}
                <div className="px-6 py-4 grid grid-cols-2 sm:grid-cols-5 gap-3 border-b border-slate-100">
                    {[
                        { label: 'Calories', value: `${Math.round(totals.totalCalories)}`, unit: 'kcal', icon: '🔥' },
                        { label: 'Protein', value: `${totals.totalProtein.toFixed(1)}`, unit: 'g', icon: '🥩' },
                        { label: 'Carbs', value: `${totals.totalCarbs.toFixed(1)}`, unit: 'g', icon: '🍞' },
                        { label: 'Fat', value: `${totals.totalFat.toFixed(1)}`, unit: 'g', icon: '🥑' },
                        { label: 'Fiber', value: `${(totals.totalFiber ?? 0).toFixed(1)}`, unit: 'g', icon: '🌿' },
                    ].map(item => (
                        <div key={item.label} className="flex flex-col items-center py-2 px-3 bg-slate-50 rounded-xl">
                            <span className="text-lg mb-0.5" aria-hidden>{item.icon}</span>
                            <span className="text-base font-black text-slate-800">{item.value}<span className="text-xs font-medium text-slate-400 ml-0.5">{item.unit}</span></span>
                            <span className="text-[9px] font-bold uppercase tracking-wider text-slate-400">{item.label}</span>
                        </div>
                    ))}
                </div>

                {/* Nutrition Chart */}
                <div className="px-6 py-5">
                    <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-4">Macro Distribution</p>
                    <NutritionChart nutrition={totals} />
                </div>
            </Card>

            {/* Per-food NutritionCards (collapsible) */}
            {expanded && (
                <div className="space-y-3">
                    <p className="text-xs font-bold text-slate-400 uppercase tracking-wider px-1">Per Food Breakdown</p>
                    {detections.map((detection, index) => (
                        <NutritionCard key={`${detection.food}-${index}`} detection={detection} colorIndex={index} />
                    ))}
                </div>
            )}
        </div>
    );
};

export default ResultCard;
