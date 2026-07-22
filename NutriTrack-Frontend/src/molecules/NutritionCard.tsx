import React from 'react';
import Card from '../atoms/Card';
import type { Detection } from '../types/nutrition';


interface NutritionCardProps {
    detection: Detection;
    colorIndex?: number;
}

const MACRO_CONFIG = [
    { key: 'protein', label: 'Protein', unit: 'g', color: '#10b981', bg: '#d1fae5', icon: '🥩' },
    { key: 'carbs', label: 'Carbs', unit: 'g', color: '#3b82f6', bg: '#dbeafe', icon: '🍞' },
    { key: 'fat', label: 'Fat', unit: 'g', color: '#f59e0b', bg: '#fef3c7', icon: '🥑' },
    { key: 'fiber', label: 'Fiber', unit: 'g', color: '#8b5cf6', bg: '#ede9fe', icon: '🌿' },
] as const;

const BBOX_COLORS = [
    '#10b981', '#3b82f6', '#f59e0b', '#ef4444', '#8b5cf6',
    '#ec4899', '#14b8a6', '#f97316', '#6366f1', '#06b6d4',
];

const NutritionCard: React.FC<NutritionCardProps> = ({ detection, colorIndex = 0 }) => {
    const accentColor = BBOX_COLORS[colorIndex % BBOX_COLORS.length];
    const foodName = detection.food.replace(/_/g, ' ');
    const totalMacros = (detection.protein ?? 0) + (detection.carbs ?? 0) + (detection.fat ?? 0) + (detection.fiber ?? 0);

    return (
        <Card className="overflow-hidden">
            {/* Header */}
            <div
                className="px-5 py-3 flex items-center justify-between"
                style={{ background: `linear-gradient(135deg, ${accentColor}15, ${accentColor}08)`, borderBottom: `2px solid ${accentColor}30` }}
            >
                <div className="flex items-center gap-3">
                    <div
                        className="w-8 h-8 rounded-lg flex items-center justify-center text-white text-xs font-black"
                        style={{ backgroundColor: accentColor }}
                    >
                        {(colorIndex + 1)}
                    </div>
                    <div>
                        <p className="text-sm font-black text-slate-800 capitalize">{foodName}</p>
                        {detection.usda_description && detection.usda_description.toLowerCase() !== detection.food.toLowerCase() && (
                            <p className="text-[10px] text-slate-400 font-medium truncate max-w-[160px]">
                                {detection.usda_description}
                            </p>
                        )}
                    </div>
                </div>
                <div className="flex flex-col items-end gap-0.5">
                    <div className="flex items-baseline gap-1">
                        <span className="text-xl font-black text-slate-800">{Math.round(detection.calories ?? 0)}</span>
                        <span className="text-xs font-bold text-slate-400">kcal</span>
                    </div>
                    {detection.portion_grams !== undefined && (
                        <span className="text-[10px] text-slate-400 font-medium">{Math.round(detection.portion_grams)}g portion</span>
                    )}
                    {detection.nutrition_source === 'usda' && (
                        <span className="text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded-md"
                            style={{ backgroundColor: `${accentColor}20`, color: accentColor }}>
                            USDA
                        </span>
                    )}
                </div>
            </div>

            {/* Macro bars */}
            <div className="px-5 py-4 grid grid-cols-2 gap-3">
                {MACRO_CONFIG.map(({ key, label, unit, color, bg, icon }) => {
                    const value = detection[key as keyof Detection] as number ?? 0;
                    const pct = totalMacros > 0 ? Math.min((value / totalMacros) * 100, 100) : 0;
                    return (
                        <div key={key} className="flex flex-col gap-1.5">
                            <div className="flex items-center justify-between">
                                <div className="flex items-center gap-1.5">
                                    <span className="text-sm" aria-hidden="true">{icon}</span>
                                    <span className="text-xs font-bold text-slate-600">{label}</span>
                                </div>
                                <span className="text-xs font-black text-slate-800">{value.toFixed(1)}<span className="text-slate-400 font-medium ml-0.5">{unit}</span></span>
                            </div>
                            <div className="h-2 rounded-full overflow-hidden" style={{ backgroundColor: bg }}>
                                <div
                                    className="h-full rounded-full transition-all duration-700 ease-out"
                                    style={{ width: `${pct}%`, backgroundColor: color }}
                                />
                            </div>
                        </div>
                    );
                })}
            </div>

            {/* Confidence */}
            {/* <div className="px-5 pb-3">
                <div className="flex items-center gap-2">
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">AI Confidence</span>
                    <div className="flex-1 h-1.5 bg-slate-100 rounded-full overflow-hidden">
                        <div
                            className="h-full rounded-full"
                            style={{
                                width: `${Math.round(detection.confidence * 100)}%`,
                                backgroundColor: detection.confidence >= 0.7 ? '#10b981' : detection.confidence >= 0.4 ? '#f59e0b' : '#ef4444'
                            }}
                        />
                    </div>
                    <span className="text-[10px] font-black text-slate-600">{Math.round(detection.confidence * 100)}%</span>
                </div>
            </div> */}
        </Card>
    );
};

export default NutritionCard;
