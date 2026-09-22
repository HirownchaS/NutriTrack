import React, { useState, useEffect, useMemo, useCallback } from 'react';
import Card from '../atoms/Card';
import Badge from '../atoms/Badge';
import { getAssignedUsers } from '../services/nutritionist';
import {
    getUserProgressData,
    type UserProgressPayload,
    type ComplianceLevel,
    type GoalStatus,
    type WeightTrend,
} from '../services/userProgressService';
import {
    Chart as ChartJS,
    CategoryScale, LinearScale, PointElement, LineElement,
    ArcElement, Filler, Tooltip, Legend,
} from 'chart.js';
import { Line, Doughnut } from 'react-chartjs-2';
import {
    FiCheckCircle, FiTrendingUp, FiTrendingDown, FiTarget,
    FiActivity, FiCalendar, FiMinus, FiAlertTriangle, FiAward,
    FiZap, FiPieChart, FiBarChart2,
} from 'react-icons/fi';

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, ArcElement, Filler, Tooltip, Legend);

//  Helpers

const complianceColors: Record<ComplianceLevel, { bg: string; text: string; border: string; badge: 'green' | 'orange' | 'red' }> = {
    good: { bg: 'bg-emerald-50', text: 'text-emerald-600', border: 'border-emerald-200', badge: 'green' },
    moderate: { bg: 'bg-amber-50', text: 'text-amber-600', border: 'border-amber-200', badge: 'orange' },
    low: { bg: 'bg-rose-50', text: 'text-rose-600', border: 'border-rose-200', badge: 'red' },
};

const goalColors: Record<GoalStatus, { bg: string; text: string; badge: 'green' | 'blue' | 'orange' | 'red' }> = {
    'on-track': { bg: 'bg-emerald-50', text: 'text-emerald-600', badge: 'green' },
    'needs-improvement': { bg: 'bg-amber-50', text: 'text-amber-600', badge: 'orange' },
    'off-track': { bg: 'bg-rose-50', text: 'text-rose-600', badge: 'red' },
    'no-data': { bg: 'bg-slate-50', text: 'text-slate-400', badge: 'blue' },
};

// const trendIcons: Record<WeightTrend, React.ReactNode> = {
//     gain: <FiTrendingUp className="w-5 h-5 text-rose-500" />,
//     loss: <FiTrendingDown className="w-5 h-5 text-emerald-500" />,
//     stable: <FiMinus className="w-5 h-5 text-blue-500" />,
//     'insufficient-data': <FiActivity className="w-5 h-5 text-slate-400" />,
// };

// const trendLabels: Record<WeightTrend, string> = {
//     gain: 'Gaining', loss: 'Losing', stable: 'Stable', 'insufficient-data': 'Insufficient Data',
// };

interface AssignedUser { id: string; userId: string; name: string; }

// ─── Sub-Components ───────────────────────────────────────────────────────────

const ComplianceRing: React.FC<{ percentage: number; level: ComplianceLevel }> = ({ percentage, level }) => {
    const radius = 54;
    const circumference = 2 * Math.PI * radius;
    const offset = circumference - (percentage / 100) * circumference;
    const strokeColor = level === 'good' ? '#10b981' : level === 'moderate' ? '#f59e0b' : '#ef4444';

    return (
        <div className="relative w-36 h-36 mx-auto">
            <svg className="w-full h-full -rotate-90" viewBox="0 0 120 120">
                <circle cx="60" cy="60" r={radius} fill="none" stroke="#e2e8f0" strokeWidth="10" />
                <circle
                    cx="60" cy="60" r={radius} fill="none"
                    stroke={strokeColor} strokeWidth="10" strokeLinecap="round"
                    strokeDasharray={circumference} strokeDashoffset={offset}
                    className="transition-all duration-1000 ease-out"
                />
            </svg>
            <div className="absolute inset-0 flex flex-col items-center justify-center">
                <span className="text-3xl font-black text-slate-800">{percentage}%</span>
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Compliance</span>
            </div>
        </div>
    );
};

const ScoreBar: React.FC<{ label: string; value: number; icon: React.ReactNode }> = ({ label, value, icon }) => (
    <div className="flex items-center gap-3">
        <div className="w-7 h-7 rounded-lg bg-slate-100 flex items-center justify-center text-slate-500 flex-shrink-0">{icon}</div>
        <div className="flex-1 min-w-0">
            <div className="flex justify-between items-center mb-1">
                <span className="text-xs font-semibold text-slate-600">{label}</span>
                <span className="text-xs font-black text-slate-800">{value}%</span>
            </div>
            <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden">
                <div
                    className={`h-full rounded-full transition-all duration-700 ease-out ${value >= 70 ? 'bg-emerald-500' : value >= 40 ? 'bg-amber-400' : 'bg-rose-400'}`}
                    style={{ width: `${value}%` }}
                />
            </div>
        </div>
    </div>
);

const MealTypeBadge: React.FC<{ type: string }> = ({ type }) => {
    const t = type.toLowerCase();
    const map: Record<string, 'green' | 'blue' | 'orange' | 'red'> = {
        breakfast: 'blue', lunch: 'green', dinner: 'orange', snack: 'red',
    };
    return <Badge color={map[t] || 'gray'}>{type}</Badge>;
};

// ─── Main Component ───────────────────────────────────────────────────────────

const NutritionistUserProgress: React.FC = () => {
    const [users, setUsers] = useState<AssignedUser[]>([]);
    const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
    const [data, setData] = useState<UserProgressPayload | null>(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [trendDays, setTrendDays] = useState<14 | 7 | 30>(14);

    // Fetch assigned users on mount
    useEffect(() => {
        (async () => {
            try {
                const res = await getAssignedUsers();
                setUsers(res.data.assigned);
                if (res.data.assigned.length > 0) setSelectedUserId(res.data.assigned[0].userId);
            } catch {
                setError('Failed to load assigned users.');
            }
        })();
    }, []);

    // Fetch progress data when user or trend period changes
    const loadProgress = useCallback(async () => {
        if (!selectedUserId) return;
        setLoading(true);
        setError(null);
        try {
            const payload = await getUserProgressData(selectedUserId, trendDays);
            setData(payload);
        } catch (err) {
            console.error('Progress fetch error:', err);
            setError('Failed to load user progress data.');
        } finally {
            setLoading(false);
        }
    }, [selectedUserId, trendDays]);

    useEffect(() => { loadProgress(); }, [loadProgress]);

    // ── Chart Data (memoized) ─────────────────────────────────────────────────

    const calorieChartData = useMemo(() => {
        if (!data) return null;
        return {
            labels: data.calorieTrend.map(r => r.label),
            datasets: [
                {
                    label: 'Calories',
                    data: data.calorieTrend.map(r => r.calories),
                    borderColor: '#10b981',
                    backgroundColor: 'rgba(16,185,129,0.08)',
                    fill: true, tension: 0.4, pointRadius: 3,
                    pointBackgroundColor: '#10b981', pointBorderColor: '#fff', pointBorderWidth: 2,
                },
                {
                    label: 'Daily Goal',
                    data: data.calorieTrend.map(() => data.profile.dailyCalorieGoal),
                    borderColor: '#94a3b8', borderDash: [6, 4],
                    pointRadius: 0, fill: false, borderWidth: 2,
                },
            ],
        };
    }, [data]);

    const macroChartData = useMemo(() => {
        if (!data) return null;
        const { protein, carbs, fats } = data.macroDistribution;
        const total = protein + carbs + fats;
        if (total === 0) return null;
        return {
            labels: ['Protein', 'Carbs', 'Fats'],
            datasets: [{
                data: [protein, carbs, fats],
                backgroundColor: ['#6366f1', '#10b981', '#f59e0b'],
                borderColor: '#fff', borderWidth: 3, hoverOffset: 8,
            }],
        };
    }, [data]);

    const weightStats = useMemo(() => {
        if (!data) return null;
        const history = data.weightHistory || [];
        const currentWeight = history.length > 0 ? history[history.length - 1].weight : data.profile.weight;
        const startingWeight = history.length > 0 ? history[0].weight : data.profile.weight;
        const weightChange = currentWeight - startingWeight;
        
        const lastThreeEntries = [...history].slice(-3).reverse();
        
        return {
            currentWeight,
            startingWeight,
            weightChange,
            lastThreeEntries
        };
    }, [data]);

    const lineOptions: any = {
        responsive: true, maintainAspectRatio: false,
        plugins: { legend: { display: true, position: 'top' as const, labels: { usePointStyle: true, padding: 16, font: { size: 11, weight: 600 } } } },
        scales: {
            x: { grid: { display: false }, ticks: { font: { size: 10 }, maxRotation: 45 } },
            y: { grid: { color: '#f1f5f9' }, ticks: { font: { size: 10 } }, beginAtZero: true },
        },
    };

    const doughnutOptions: any = {
        responsive: true, maintainAspectRatio: false, cutout: '65%',
        plugins: {
            legend: { position: 'bottom' as const, labels: { usePointStyle: true, padding: 16, font: { size: 11, weight: 600 } } },
            tooltip: { callbacks: { label: (ctx: any) => `${ctx.label}: ${ctx.raw}g` } },
        },
    };

    // ── Render ─────────────────────────────────────────────────────────────────

    if (!users.length && !loading) {
        return (
            <div className="space-y-8 animate-fade-in">
                <div><h2 className="text-2xl font-black text-slate-800 tracking-tight">User Progress</h2></div>
                <Card className="p-12 text-center border-dashed border-2 border-slate-200 bg-slate-50">
                    <FiAlertTriangle className="w-8 h-8 text-slate-300 mx-auto mb-3" />
                    <p className="text-slate-400 font-medium">No assigned users found. Accept user requests to start monitoring progress.</p>
                </Card>
            </div>
        );
    }

    return (
        <div className="space-y-8 animate-fade-in">
            {/* Header */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div>
                    <h2 className="text-2xl font-black text-slate-800 tracking-tight">User Progress Dashboard</h2>
                    <p className="text-slate-500 text-sm font-medium mt-1">Comprehensive dietary compliance and health performance tracking.</p>
                </div>
                <div className="flex items-center gap-3 flex-wrap">
                    {/* Period selector */}
                    <div className="flex bg-slate-100 rounded-xl p-1">
                        {([7, 14, 30] as const).map(d => (
                            <button
                                key={d} onClick={() => setTrendDays(d)}
                                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${trendDays === d ? 'bg-white text-emerald-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                            >{d}D</button>
                        ))}
                    </div>
                    {/* User selector */}
                    <select
                        className="bg-white border border-slate-200 rounded-xl px-4 py-2.5 text-sm font-bold shadow-sm focus:ring-2 focus:ring-emerald-500 outline-none custom-select"
                        value={selectedUserId || ''} onChange={e => setSelectedUserId(e.target.value)}
                    >
                        {users.map(u => <option key={u.userId} value={u.userId}>{u.name}</option>)}
                    </select>
                </div>
            </div>

            {error && <div className="p-4 bg-rose-50 text-rose-600 rounded-2xl border border-rose-100 text-sm font-medium">{error}</div>}

            {loading ? (
                <div className="p-16 text-center"><div className="w-10 h-10 border-4 border-emerald-200 border-t-emerald-600 rounded-full animate-spin mx-auto" /></div>
            ) : data && (
                <div className="space-y-6">
                    {/* ── Row 1: KPI Cards ──────────────────────────────────────── */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
                        {/* Calorie Compliance */}
                        <Card className={`p-5 ${complianceColors[data.compliance.level].border} border hover:-translate-y-1 transition-all duration-300`}>
                            <div className="flex items-center justify-between mb-3">
                                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Calorie Compliance</p>
                                <FiCheckCircle className={`w-5 h-5 ${complianceColors[data.compliance.level].text}`} />
                            </div>
                            <p className={`text-3xl font-black ${complianceColors[data.compliance.level].text}`}>{data.compliance.percentage}%</p>
                            <Badge color={complianceColors[data.compliance.level].badge} className="mt-2">{data.compliance.label}</Badge>
                        </Card>

                        {/* Weight Trend */}
                        {/* <Card className="p-5 border border-indigo-100 hover:-translate-y-1 transition-all duration-300">
                            <div className="flex items-center justify-between mb-3">
                                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Weight Trend</p>
                                {trendIcons[data.weightTrend]}
                            </div>
                            <p className="text-3xl font-black text-indigo-600">
                                {data.weightHistory.length > 0 ? `${data.weightHistory[data.weightHistory.length - 1].weight} kg` : '—'}
                            </p>
                            <p className="text-xs font-semibold text-slate-400 mt-2">{trendLabels[data.weightTrend]}</p>
                        </Card> */}

                        {/* Goal Achievement */}
                        <Card className={`p-5 border ${data.goalAchievement.status === 'on-track' ? 'border-emerald-100' : data.goalAchievement.status === 'needs-improvement' ? 'border-amber-100' : 'border-rose-100'} hover:-translate-y-1 transition-all duration-300`}>
                            <div className="flex items-center justify-between mb-3">
                                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Goal Status</p>
                                <FiTarget className={`w-5 h-5 ${goalColors[data.goalAchievement.status].text}`} />
                            </div>
                            <p className={`text-3xl font-black ${goalColors[data.goalAchievement.status].text}`}>{data.goalAchievement.overallScore}%</p>
                            <Badge color={goalColors[data.goalAchievement.status].badge} className="mt-2">{data.goalAchievement.label}</Badge>
                        </Card>

                        {/* Daily Average */}
                        <Card className="p-5 border border-slate-100 hover:-translate-y-1 transition-all duration-300">
                            <div className="flex items-center justify-between mb-3">
                                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Daily Avg</p>
                                <FiZap className="w-5 h-5 text-amber-500" />
                            </div>
                            <p className="text-3xl font-black text-slate-800">{data.compliance.dailyAvgCalories}</p>
                            <p className="text-xs font-semibold text-slate-400 mt-2">of {data.compliance.dailyGoal} kcal goal</p>
                        </Card>
                    </div>

                    {/* ── Row 2: Compliance Ring + Goal Breakdown ───────────────── */}
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                        <Card className="p-7">
                            <h3 className="text-sm font-bold text-slate-700 uppercase tracking-wider mb-5 flex items-center gap-2">
                                <span className="w-2 h-2 rounded-full bg-emerald-500" />Compliance Overview
                            </h3>
                            <ComplianceRing percentage={data.compliance.percentage} level={data.compliance.level} />
                            <div className="mt-4 text-center">
                                <p className="text-sm text-slate-500">Avg <strong className="text-slate-800">{data.compliance.dailyAvgCalories} kcal</strong> / day</p>
                                <p className="text-xs text-slate-400 mt-1">Goal: {data.compliance.dailyGoal} kcal</p>
                            </div>
                        </Card>

                        <Card className="p-7">
                            <h3 className="text-sm font-bold text-slate-700 uppercase tracking-wider mb-5 flex items-center gap-2">
                                <span className="w-2 h-2 rounded-full bg-indigo-500" />Goal Achievement Breakdown
                            </h3>
                            <div className="space-y-5 mt-2">
                                <ScoreBar label="Calorie Compliance" value={data.goalAchievement.calorieCompliance} icon={<FiZap className="w-3.5 h-3.5" />} />
                                <ScoreBar label="Macro Balance" value={data.goalAchievement.macroBalance} icon={<FiPieChart className="w-3.5 h-3.5" />} />
                                <ScoreBar label="Logging Consistency" value={data.goalAchievement.loggingConsistency} icon={<FiBarChart2 className="w-3.5 h-3.5" />} />
                            </div>
                            <div className="mt-6 p-4 rounded-xl bg-slate-50 flex items-center gap-3">
                                <FiAward className={`w-6 h-6 flex-shrink-0 ${goalColors[data.goalAchievement.status].text}`} />
                                <div>
                                    <p className="text-sm font-bold text-slate-800">Overall Score: {data.goalAchievement.overallScore}%</p>
                                    <p className="text-xs text-slate-400">{data.goalAchievement.label}</p>
                                </div>
                            </div>
                        </Card>
                    </div>

                    {/* ── Row 3: Calorie Trend Chart ───────────────────────────── */}
                    <Card className="p-7">
                        <h3 className="text-sm font-bold text-slate-700 uppercase tracking-wider mb-5 flex items-center gap-2">
                            <span className="w-2 h-2 rounded-full bg-emerald-500" />Calorie Intake Trend ({trendDays} Days)
                        </h3>
                        <div className="h-72">
                            {calorieChartData ? (
                                <Line data={calorieChartData} options={lineOptions} />
                            ) : (
                                <div className="h-full flex items-center justify-center text-slate-400 text-sm italic">No calorie data available</div>
                            )}
                        </div>
                    </Card>

                    {/* ── Row 4: Macro Pie + Weight Chart ──────────────────────── */}
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                        <Card className="p-7">
                            <h3 className="text-sm font-bold text-slate-700 uppercase tracking-wider mb-5 flex items-center gap-2">
                                <span className="w-2 h-2 rounded-full bg-indigo-500" />Macro Distribution
                            </h3>
                            <div className="h-64">
                                {macroChartData ? (
                                    <Doughnut data={macroChartData} options={doughnutOptions} />
                                ) : (
                                    <div className="h-full flex items-center justify-center text-slate-400 text-sm italic">No macro data</div>
                                )}
                            </div>
                            {macroChartData && (
                                <div className="grid grid-cols-3 gap-3 mt-4">
                                    {[
                                        { label: 'Protein', value: data.macroDistribution.protein, color: 'text-indigo-600' },
                                        { label: 'Carbs', value: data.macroDistribution.carbs, color: 'text-emerald-600' },
                                        { label: 'Fats', value: data.macroDistribution.fats, color: 'text-amber-600' },
                                    ].map(m => (
                                        <div key={m.label} className="text-center p-2 rounded-xl bg-slate-50">
                                            <p className="text-lg font-black text-slate-800">{m.value}g</p>
                                            <p className={`text-[10px] font-bold uppercase tracking-wider ${m.color}`}>{m.label}</p>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </Card>

                        <Card className="p-7">
                            <h3 className="text-sm font-bold text-slate-700 uppercase tracking-wider mb-5 flex items-center gap-2">
                                <span className="w-2 h-2 rounded-full bg-violet-500" />Weight Progress
                            </h3>
                            {weightStats && (
                                <div className="space-y-6">
                                    {/* Main Metrics Row */}
                                    <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                                        <div>
                                            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Current Weight</p>
                                            <p className="text-4xl font-black text-slate-800 tracking-tight">
                                                {weightStats.currentWeight ? `${weightStats.currentWeight} kg` : '—'}
                                            </p>
                                        </div>

                                        {data.weightHistory.length >= 2 ? (
                                            <div className="flex flex-col items-start sm:items-end">
                                                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Net Change</p>
                                                <div className="flex items-center gap-2">
                                                    {weightStats.weightChange < 0 ? (
                                                        <div className="flex items-center gap-1 text-rose-500 font-bold text-sm bg-rose-50 px-2.5 py-1 rounded-xl">
                                                            <FiTrendingDown className="w-4 h-4" />
                                                            <span>{weightStats.weightChange.toFixed(1)} kg</span>
                                                        </div>
                                                    ) : weightStats.weightChange > 0 ? (
                                                        <div className="flex items-center gap-1 text-emerald-500 font-bold text-sm bg-emerald-50 px-2.5 py-1 rounded-xl">
                                                            <FiTrendingUp className="w-4 h-4" />
                                                            <span>+{weightStats.weightChange.toFixed(1)} kg</span>
                                                        </div>
                                                    ) : (
                                                        <div className="flex items-center gap-1 text-slate-500 font-bold text-sm bg-slate-50 px-2.5 py-1 rounded-xl">
                                                            <FiMinus className="w-4 h-4" />
                                                            <span>Stable</span>
                                                        </div>
                                                    )}
                                                </div>
                                            </div>
                                        ) : (
                                            <div className="flex items-center gap-1.5 text-slate-400 font-bold text-xs bg-slate-50 px-2.5 py-1.5 rounded-xl border border-slate-100 italic">
                                                {/* <FiActivity className="w-3.5 h-3.5" /> */}
                                                {/* <span>Insufficient data for trend analysis</span> */}
                                            </div>
                                        )}
                                    </div>


                                    {/* Last 3 Entries List */}
                                    <div>
                                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3">Recent Entries</p>
                                        {weightStats.lastThreeEntries.length > 0 ? (
                                            <div className="space-y-2">
                                                {weightStats.lastThreeEntries.map((entry, idx) => (
                                                    <div key={idx} className="flex justify-between items-center p-3 rounded-xl bg-slate-50 hover:bg-slate-100/50 transition-colors border border-slate-100">
                                                        <div className="flex items-center gap-2.5">
                                                    <span className="w-1.5 h-1.5 rounded-full bg-violet-400" />
                                                            <span className="text-xs font-bold text-slate-600">{entry.date}</span>
                                                        </div>
                                                        <span className="text-xs font-black text-slate-800">{entry.weight} kg</span>
                                                    </div>
                                                ))}
                                            </div>
                                        ) : (
                                            <p className="text-xs text-slate-400 italic">No weight history records logged yet.</p>
                                        )}
                                    </div>
                                </div>
                            )}
                        </Card>
                    </div>

                    {/* ── Row 5: Recent Food Logs ──────────────────────────────── */}
                    <Card className="p-7">
                        <h3 className="text-sm font-bold text-slate-700 uppercase tracking-wider mb-5 flex items-center gap-2">
                            <span className="w-2 h-2 rounded-full bg-teal-500" />
                            <FiCalendar className="w-4 h-4 text-teal-500" />
                            Recent Food Logs
                        </h3>
                        {data.recentLogs.length > 0 ? (
                            <div className="overflow-x-auto">
                                <table className="w-full text-sm">
                                    <thead>
                                        <tr className="border-b border-slate-100">
                                            {['Food', 'Meal', 'Calories', 'Protein', 'Carbs', 'Fats', 'Date'].map(h => (
                                                <th key={h} className="text-left py-3 px-3 text-[10px] font-black text-slate-400 uppercase tracking-widest">{h}</th>
                                            ))}
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {data.recentLogs.map(log => (
                                            <tr key={log.id} className="border-b border-slate-50 hover:bg-slate-50/50 transition-colors">
                                                <td className="py-3 px-3 font-semibold text-slate-800">{log.foodName}</td>
                                                <td className="py-3 px-3"><MealTypeBadge type={log.mealType} /></td>
                                                <td className="py-3 px-3 font-black text-emerald-600">{log.calories} kcal</td>
                                                <td className="py-3 px-3 text-indigo-600 font-semibold">{log.protein}g</td>
                                                <td className="py-3 px-3 text-emerald-600 font-semibold">{log.carbs}g</td>
                                                <td className="py-3 px-3 text-amber-600 font-semibold">{log.fats}g</td>
                                                <td className="py-3 px-3 text-slate-400">{log.date}</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        ) : (
                            <div className="h-48 bg-slate-50 rounded-2xl border-2 border-dashed border-slate-200 flex items-center justify-center">
                                <p className="text-slate-400 text-sm font-medium italic">No food logs found for this user</p>
                            </div>
                        )}
                    </Card>
                </div>
            )}
        </div>
    );
};

export default NutritionistUserProgress;
