import React from 'react';
import type { NutritionSummaryData } from '../types/nutrition';



interface NutritionChartProps {
    nutrition: NutritionSummaryData;
}

const MACROS = [
    { key: 'totalProtein', label: 'Protein', color: '#10b981', icon: '🥩' },
    { key: 'totalCarbs', label: 'Carbs', color: '#3b82f6', icon: '🍞' },
    { key: 'totalFat', label: 'Fat', color: '#f59e0b', icon: '🥑' },
    { key: 'totalFiber', label: 'Fiber', color: '#8b5cf6', icon: '🌿' },
] as const;

function buildArcs(values: number[], cx: number, cy: number, r: number) {
    const total = values.reduce((a, b) => a + b, 0);
    if (total === 0) return values.map(() => '');

    const arcs: string[] = [];
    let startAngle = -Math.PI / 2; // Start from top

    for (const value of values) {
        const fraction = value / total;
        const angle = fraction * 2 * Math.PI;
        const endAngle = startAngle + angle;

        const x1 = cx + r * Math.cos(startAngle);
        const y1 = cy + r * Math.sin(startAngle);
        const x2 = cx + r * Math.cos(endAngle);
        const y2 = cy + r * Math.sin(endAngle);
        const largeArc = angle > Math.PI ? 1 : 0;

        arcs.push(`M ${cx} ${cy} L ${x1} ${y1} A ${r} ${r} 0 ${largeArc} 1 ${x2} ${y2} Z`);
        startAngle = endAngle;
    }
    return arcs;
}

const NutritionChart: React.FC<NutritionChartProps> = ({ nutrition }) => {
    const values = MACROS.map(m => Number(nutrition[m.key] ?? 0));
    const total = values.reduce((a, b) => a + b, 0);

    const SIZE = 180;
    const cx = SIZE / 2;
    const cy = SIZE / 2;
    const outerR = 75;
    const innerR = 45;

    const arcs = buildArcs(values, cx, cy, outerR);

    const dietRecommendation = (() => {
        const { totalCalories = 0, totalProtein = 0, totalCarbs = 0, totalFiber = 0 } = nutrition;
        if (totalCalories > 2500) return { type: 'warning', msg: 'High calorie meal detected. Consider lighter options next time.' };
        if (totalProtein < 10 && totalCalories > 300) return { type: 'info', msg: 'Low protein intake. Adding lean protein can boost satiety.' };
        if (totalCarbs > 150) return { type: 'info', msg: 'High carb content. Balance with fiber-rich vegetables.' };
        if (totalFiber > 10) return { type: 'success', msg: 'Great fiber intake! This supports digestion and gut health.' };
        if (totalCalories < 100) return { type: 'info', msg: 'Light meal detected. Ensure you meet your daily calorie needs.' };
        return null;
    })();

    return (
        <div className="space-y-4">
            {/* Chart + Legend row */}
            <div className="flex flex-col sm:flex-row items-center gap-6">
                {/* SVG Donut Chart */}
                <div className="relative flex-shrink-0">
                    <svg width={SIZE} height={SIZE} viewBox={`0 0 ${SIZE} ${SIZE}`} aria-label="Macro distribution chart">
                        {/* Background circle */}
                        <circle cx={cx} cy={cy} r={outerR} fill="#f1f5f9" />

                        {total > 0 ? (
                            arcs.map((d, i) => (
                                <path
                                    key={MACROS[i].key}
                                    d={d}
                                    fill={MACROS[i].color}
                                    opacity={0.9}
                                    className="transition-all duration-500"
                                >
                                    <title>{MACROS[i].label}: {values[i].toFixed(1)}g</title>
                                </path>
                            ))
                        ) : (
                            <circle cx={cx} cy={cy} r={outerR} fill="#e2e8f0" />
                        )}

                        {/* Donut hole */}
                        <circle cx={cx} cy={cy} r={innerR} fill="white" />

                        {/* Center text */}
                        <text x={cx} y={cy - 8} textAnchor="middle" fill="#1e293b" fontSize="20" fontWeight="900" fontFamily="system-ui">
                            {Math.round(nutrition.totalCalories)}
                        </text>
                        <text x={cx} y={cy + 10} textAnchor="middle" fill="#94a3b8" fontSize="10" fontWeight="700" fontFamily="system-ui">
                            kcal
                        </text>
                    </svg>
                </div>

                {/* Legend */}
                <div className="flex-1 grid grid-cols-2 gap-3 w-full">
                    {MACROS.map((m, i) => {
                        const value = values[i];
                        const pct = total > 0 ? Math.round((value / total) * 100) : 0;
                        return (
                            <div key={m.key} className="flex flex-col gap-1">
                                <div className="flex items-center gap-2">
                                    <div className="w-3 h-3 rounded-full flex-shrink-0" style={{ backgroundColor: m.color }} />
                                    <span className="text-xs font-bold text-slate-600">{m.icon} {m.label}</span>
                                </div>
                                <div className="flex items-baseline gap-1 ml-5">
                                    <span className="text-lg font-black text-slate-800">{value.toFixed(1)}</span>
                                    <span className="text-[10px] font-bold text-slate-400">g</span>
                                    <span className="text-[10px] font-medium text-slate-400 ml-1">({pct}%)</span>
                                </div>
                                <div className="ml-5 h-1.5 rounded-full overflow-hidden bg-slate-100">
                                    <div
                                        className="h-full rounded-full transition-all duration-700"
                                        style={{ width: `${pct}%`, backgroundColor: m.color }}
                                    />
                                </div>
                            </div>
                        );
                    })}
                </div>
            </div>

            {/* Diet Recommendation Banner */}
            {dietRecommendation && (
                <div className={`flex items-start gap-3 p-3 rounded-xl text-sm border-l-4 ${
                    dietRecommendation.type === 'warning'
                        ? 'bg-red-50 border-red-500 text-red-700'
                        : dietRecommendation.type === 'success'
                        ? 'bg-emerald-50 border-emerald-500 text-emerald-700'
                        : 'bg-blue-50 border-blue-500 text-blue-700'
                }`}>
                    <span className="text-base flex-shrink-0">
                        {dietRecommendation.type === 'warning' ? '⚠️' : dietRecommendation.type === 'success' ? '✅' : '💡'}
                    </span>
                    <div>
                        <p className="font-bold">Diet Insight</p>
                        <p className="text-xs mt-0.5 opacity-90">{dietRecommendation.msg}</p>
                    </div>
                </div>
            )}
        </div>
    );
};

export default NutritionChart;
