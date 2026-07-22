import React, { useState, useEffect } from 'react';
import { useLocation, Routes, Route, Navigate } from 'react-router-dom';
import DashboardLayout from '../organisms/DashboardLayout';
import NutritionSummary from '../organisms/NutritionSummary';
import UploadSection from '../organisms/UploadSection';
import ProgressChart from '../organisms/ProgressChart';
import ResultCard from '../molecules/ResultCard';
import GoalForm from '../molecules/GoalForm';
import DailyGoalTracker from '../molecules/DailyGoalTracker';
import DietRecommendation from './DietRecommendation';
import Profile from './Profile';
import RequestNutritionist from './RequestNutritionist';
import ChatModule from '../molecules/ChatModule';
import ManualFoodLogForm from '../molecules/ManualFoodLogForm';
import Card from '../atoms/Card';
import { getRecentFoodUploads, getActiveDietPlan, getDailyIntakeHistory } from '../services/dashboard';
import { FiClock, FiTarget, FiTrendingUp, FiCheckCircle, FiAlertCircle, FiArrowUp, FiLock } from 'react-icons/fi';
import { RecentUpload, DietPlan, IntakeHistory, DetectionResult } from '../types/nutrition';

type IntakeHistoryWithGrouped = IntakeHistory & { grouped?: Record<string, any[]> };

// dashboard home
const HomeSection: React.FC = () => {
    const [uploads, setUploads] = useState<RecentUpload[]>([]);
    const [plan, setPlan] = useState<DietPlan | null>(null);

    const isDietPlan = (data: any): data is DietPlan => {
        return data && data.active === true && typeof data.name === 'string' && typeof data.dailyCalories === 'number'
            && typeof data.progress === 'number' && typeof data.daysRemaining === 'number'
            && data.macros && typeof data.macros.protein === 'number' && typeof data.macros.carbs === 'number'
            && typeof data.macros.fats === 'number' && typeof data.nutritionist === 'string'
            && typeof data.startDate === 'string' && typeof data.endDate === 'string';
    };

    useEffect(() => {
        const fetch = async () => {
            try {
                const [u, p] = await Promise.all([getRecentFoodUploads(), getActiveDietPlan()]);
                setUploads(u.data);
                if (isDietPlan(p.data)) setPlan(p.data);
                else setPlan(null);
            } catch (e) { console.error(e); }
        };
        fetch();
    }, []);

    return (
        <div className="space-y-8 animate-fade-in">
            <div>
                <h1 className="text-2xl md:text-3xl font-black text-slate-800 tracking-tight">Welcome back! 👋</h1>
                <p className="text-slate-500 mt-1 text-sm font-medium">Here's your daily nutritional overview.</p>
            </div>

            <NutritionSummary />
            <ProgressChart />

            {plan?.active && (
                <Card className="p-6 bg-linear-to-r from-emerald-600 to-teal-600 text-white relative overflow-hidden">
                    <div className="absolute top-0 right-0 w-40 h-40 bg-white/10 rounded-full -translate-y-1/2 translate-x-1/2 blur-xl" />
                    <div className="relative z-10">
                        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-4">
                            <div>
                                <p className="text-emerald-200 text-xs font-bold uppercase tracking-widest mb-1">Active Diet Plan</p>
                                <h3 className="text-xl font-black">{plan.name}</h3>
                                <p className="text-emerald-100 text-sm font-medium mt-1">by {plan.nutritionist} • {plan.daysRemaining} days remaining</p>
                            </div>
                            <div className="flex items-center gap-2 bg-white/15 px-4 py-2 rounded-xl">
                                <FiTarget /> <span className="text-lg font-black">{plan.dailyCalories}</span> <span className="text-sm text-emerald-200">kcal/day</span>
                            </div>
                        </div>
                        <div className="mt-2">
                            <div className="flex justify-between text-xs font-bold text-emerald-200 mb-1.5"><span>Plan Progress</span><span>{plan.progress}%</span></div>
                            <div className="h-2.5 bg-white/20 rounded-full overflow-hidden"><div className="h-full bg-white transition-all duration-700" style={{ width: `${plan.progress}%` }} /></div>
                        </div>
                        <div className="grid grid-cols-3 gap-3 mt-4">
                            {[{ l: 'Protein', v: plan.macros.protein }, { l: 'Carbs', v: plan.macros.carbs }, { l: 'Fats', v: plan.macros.fats }].map(m => (
                                <div key={m.l} className="bg-white/10 p-3 rounded-xl text-center">
                                    <p className="text-lg font-black">{m.v}g</p>
                                    <p className="text-[10px] text-emerald-200 uppercase font-bold tracking-wider">{m.l}</p>
                                </div>
                            ))}
                        </div>
                    </div>
                </Card>
            )}

            {uploads.length > 0 && (
                <div>
                    <h2 className="text-lg font-bold text-slate-800 mb-4 flex items-center gap-2"><span className="w-2 h-2 rounded-full bg-blue-500" />Recent Food Uploads</h2>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                        {uploads.map(i => (
                            <Card key={i.id} className="p-4 hover:-translate-y-1 transition-all group">
                                <div className="flex items-center gap-3 mb-3">
                                    <div className="w-10 h-10 bg-slate-100 rounded-xl flex items-center justify-center text-lg">{i.image}</div>
                                    <div className="min-w-0 flex-1">
                                        <p className="font-bold text-slate-800 text-sm truncate">{i.name}</p>
                                        <p className="text-xs text-slate-400 font-medium flex items-center gap-1"><FiClock /> {i.time}</p>
                                    </div>
                                </div>
                                <div className="flex items-center justify-between text-xs">
                                    <span className="font-black text-emerald-600">{i.calories} kcal</span>
                                    <span className="text-slate-400 font-medium">P:{i.protein}g C:{i.carbs}g F:{i.fats}g</span>
                                </div>
                            </Card>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
};

// food upload
const FoodUploadSection: React.FC = () => {
    const [results, setResults] = useState<DetectionResult[]>([]);
    const count = results.reduce((s, r) => s + r.detections.length, 0);

    return (
        <div className="space-y-8 animate-fade-in">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-4">
                <div>
                    <h1 className="text-2xl md:text-3xl font-black text-slate-800 tracking-tight">Food Upload</h1>
                    <p className="text-slate-500 mt-1 text-sm font-medium">Recognize meals using AI.</p>
                </div>
                {count > 0 && (
                    <div className="bg-white px-5 py-3 rounded-xl shadow-md flex items-center gap-3 border border-emerald-100">
                        <span className="text-2xl">🔍</span>
                        <div><p className="text-xs font-bold text-slate-400 uppercase">Detected</p><p className="text-xl font-black text-emerald-600">{count} <span className="text-sm text-slate-400 font-medium">items</span></p></div>
                    </div>
                )}
            </div>
            <DailyGoalTracker />
            <UploadSection onDetectionComplete={(r) => setResults(p => [...p, r])} />
            {results.length > 0 && <div className="space-y-4">{results.map((r, i) => <ResultCard key={i} detections={r.detections} nutrition={r.nutrition} />)}</div>}
        </div>
    );
};

// tracking
const TrackingSection: React.FC = () => {
    const [history, setHistory] = useState<IntakeHistoryWithGrouped | null>(null);

    const fetch = async () => {
        try {
            const res = await getDailyIntakeHistory();
            setHistory(res.data as IntakeHistoryWithGrouped);
        } catch (e) { console.error(e); }
    };

    useEffect(() => { fetch(); }, []);

    const getStatus = (s: string) => {
        if (s === 'on-track') return { l: 'On Track', i: FiCheckCircle, c: 'text-emerald-600 bg-emerald-50 border-emerald-200' };
        if (s === 'over') return { l: 'Over Target', i: FiAlertCircle, c: 'text-red-600 bg-red-50 border-red-200' };
        return { l: 'Under Target', i: FiArrowUp, c: 'text-orange-600 bg-orange-50 border-orange-200' };
    };

    return (
        <div className="space-y-8 animate-fade-in">
            <div>
                <h1 className="text-2xl md:text-3xl font-black text-slate-800 tracking-tight">Progress Tracking</h1>
                <p className="text-slate-500 mt-1 text-sm font-medium">Monitor intake and goals.</p>
            </div>

            {history && (
                <Card className="p-6">
                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
                        <div>
                            <h3 className="text-sm font-bold text-slate-700 uppercase tracking-wider mb-1">Today's Intake</h3>
                            <div className="flex items-baseline gap-2"><span className="text-3xl font-black text-slate-800">{history.consumed}</span><span className="text-slate-400 font-medium">/ {history.dailyGoal} kcal</span></div>
                        </div>
                        {(() => {
                            const s = getStatus(history.compliance);
                            return <div className={`flex items-center gap-2 px-4 py-2 rounded-xl border font-bold text-sm ${s.c}`}><s.i />{s.l}</div>;
                        })()}
                    </div>
                    <div className="grid grid-cols-3 gap-4 mb-6">
                        {[{ l: 'Protein', v: history.macros?.protein, c: 'text-emerald-600', b: 'bg-emerald-50' }, { l: 'Carbs', v: history.macros?.carbs, c: 'text-blue-600', b: 'bg-blue-50' }, { l: 'Fats', v: history.macros?.fats, c: 'text-orange-600', b: 'bg-orange-50' }].map(m => (
                            <div key={m.l} className={`${m.b} p-3 rounded-2xl text-center`}><p className={`text-lg font-black ${m.c}`}>{m.v || 0}g</p><p className="text-[10px] text-slate-400 font-black uppercase tracking-widest">{m.l}</p></div>
                        ))}
                    </div>
                    <div className="h-3 bg-slate-100 rounded-full overflow-hidden"><div className={`h-full transition-all duration-700 ${history.compliance === 'over' ? 'bg-red-500' : history.compliance === 'under' ? 'bg-orange-400' : 'bg-emerald-500'}`} style={{ width: `${Math.min((history.consumed / history.dailyGoal) * 100, 100)}%` }} /></div>
                </Card>
            )}

            <ProgressChart />
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6"><ManualFoodLogForm onSuccess={fetch} /><GoalForm onSuccess={fetch} /></div>

            {history && (
                <div className="space-y-6">
                    {['breakfast', 'lunch', 'dinner', 'snacks'].map(mealType => (
                        <Card key={mealType} className="p-6">
                            <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest mb-4 flex items-center gap-2">
                                <span className="w-2 h-2 rounded-full bg-emerald-500" />
                                {mealType}
                            </h3>
                            <div className="space-y-3">
                                {history.grouped && history.grouped[mealType]?.length > 0 ? (
                                    history.grouped[mealType].map((i: any) => (
                                        <div key={i.id} className="flex items-center gap-4 p-4 rounded-xl bg-slate-50 hover:bg-slate-100 transition-colors border border-slate-100">
                                            <div className="w-10 h-10 rounded-xl bg-white shadow-sm flex items-center justify-center shrink-0 text-xl">
                                                {i.source === 'ai' ? '🤖' : '✍️'}
                                            </div>
                                            <div className="flex-1 min-w-0">
                                                <p className="text-sm font-bold text-slate-800 truncate">{i.name}</p>
                                                <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">{i.source === 'ai' ? 'AI Recommended' : 'Manual Entry'}</p>
                                            </div>
                                            <div className="text-right shrink-0">
                                                <p className="text-sm font-black text-emerald-600">{i.kcal} kcal</p>
                                                <p className="text-[10px] text-slate-400 font-bold uppercase">P:{i.protein}g C:{i.carbs}g F:{i.fats}g</p>
                                            </div>
                                        </div>
                                    ))
                                ) : (
                                    <p className="text-xs text-slate-400 font-medium italic p-2">No items logged for {mealType} yet.</p>
                                )}
                            </div>
                        </Card>
                    ))}
                </div>
            )}
        </div>
    );
};

// dashboard
const Dashboard: React.FC = () => {
    const loc = useLocation();
    const error = new URLSearchParams(loc.search).get('error') === 'access-denied';

    return (
        <DashboardLayout>
            {error && (
                <div className="mb-6 animate-bounce">
                    <div className="p-4 bg-red-50 text-red-700 rounded-2xl border-2 border-red-200 shadow-lg flex items-center gap-4">
                        <div className="w-12 h-12 rounded-xl bg-red-600 flex items-center justify-center text-white shadow-lg"><FiLock className="w-6 h-6" /></div>
                        <div><p className="font-black text-lg">Access Denied</p><p className="text-sm font-bold opacity-80">You do not have permission to access the requested page.</p></div>
                    </div>
                </div>
            )}
            <Routes>
                <Route index element={<Navigate to="/dashboard/home" replace />} />
                <Route path="home" element={<HomeSection />} />
                <Route path="upload" element={<FoodUploadSection />} />
                <Route path="recommendation" element={<DietRecommendation />} />
                <Route path="tracking" element={<TrackingSection />} />
                <Route path="profile" element={<Profile />} />
                <Route path="request" element={<RequestNutritionist />} />
                <Route path="chat" element={
                    <div className="space-y-8 animate-fade-in">
                        <div><h1 className="text-2xl md:text-3xl font-black text-slate-800 tracking-tight">Support Chat</h1><p className="text-slate-500 mt-1 text-sm font-medium">Chat with your assigned nutritionist.</p></div>
                        <ChatModule />
                    </div>
                } />
                <Route path="*" element={<Navigate to="/dashboard/home" replace />} />
            </Routes>
        </DashboardLayout>
    );
};

export default Dashboard;
