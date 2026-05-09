import React, { useState, useEffect } from 'react';
import Card from '../atoms/Card';
import { useAuth } from '../context/AuthContext';
import { db } from '../firebase/config';
import { calculateDynamicCalories } from '../services/api';



const DailyGoalTracker: React.FC = () => {
    const { user } = useAuth();
    const [consumed, setConsumed] = useState<number>(0);
    const [goal, setGoal] = useState<number>(2000);
    const [loading, setLoading] = useState(true);
    
    // UI states for editing
    const [isEditing, setIsEditing] = useState(false);
    const [tempGoal, setTempGoal] = useState<number>(2000);
    const [isSaving, setIsSaving] = useState(false);
    const [dynamicGoal, setDynamicGoal] = useState<number>(2000);

    useEffect(() => {
        if (!user) { setLoading(false); return; }

        let unsubscribe = () => {};

        const loadData = async () => {
            try {
                const { getDailyProgress } = await import('../services/api');
                const progress = await getDailyProgress(user.uid);
                setConsumed(Math.round(progress.totalCalories));
            } catch (err) {
                console.warn('DailyGoalTracker: Could not fetch progress:', err);
            }

            try {
                const { doc, onSnapshot } = await import('firebase/firestore');
                // Real-time listener for the user's goal
                unsubscribe = onSnapshot(doc(db, 'users', user.uid), (docSnap) => {
                    if (docSnap.exists()) {
                        const uData = docSnap.data();
                        if (uData.dailyCalorieGoal) {
                            setGoal(uData.dailyCalorieGoal);
                            setTempGoal(uData.dailyCalorieGoal);
                        } else {
                            // Dynamically calculate based on user's profile
                            const calc = calculateDynamicCalories(uData);
                            setDynamicGoal(calc);
                            setGoal(calc);
                            setTempGoal(calc);
                        }
                    }
                    setLoading(false);
                }, (err) => {
                    console.warn('DailyGoalTracker: listener error:', err);
                    setLoading(false);
                });
            } catch (err) {
                console.warn('DailyGoalTracker: could not setup listener', err);
                setLoading(false);
            }
        };

        loadData();

        return () => unsubscribe();
    }, [user]);

    const handleSaveGoal = async () => {
        if (!user) return;
        const val = Math.round(tempGoal);
        
        // Basic validation
        if (val < 1000 || val > 10000) {
            alert("Please enter a realistic calorie goal (1000 - 10000 kcal).");
            return;
        }
        
        setIsSaving(true);
        try {
            const { doc, updateDoc } = await import('firebase/firestore');
            await updateDoc(doc(db, 'users', user.uid), {
                dailyCalorieGoal: val
            });
            setIsEditing(false);
        } catch (err) {
            console.error("Failed to update goal:", err);
            alert("Failed to save goal. Please ensure you are connected.");
        } finally {
            setIsSaving(false);
        }
    };

    const pct = Math.min((consumed / goal) * 100, 100);
    const remaining = Math.max(goal - consumed, 0);
    const isOver = consumed > goal;

    if (loading) return null;

    return (
        <Card className="p-5">
            <div className="flex items-center justify-between mb-4">
                <div>
                    <div className="flex items-center gap-2 mb-0.5">
                        <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">Daily Calorie Goal</p>
                        {!isEditing && (
                            <button 
                                onClick={() => setIsEditing(true)} 
                                className="text-slate-300 hover:text-emerald-500 transition-colors p-0.5 rounded focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
                                title="Edit Goal"
                            >
                                <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                                </svg>
                            </button>
                        )}
                    </div>
                    
                    {isEditing ? (
                        <div className="flex items-center gap-2 mt-1">
                            <input 
                                type="number" 
                                className="w-20 px-2 py-1 text-sm border border-slate-200 rounded-lg font-black text-slate-800 focus:outline-none focus:border-emerald-500 transition-colors"
                                value={tempGoal}
                                onChange={(e) => setTempGoal(Number(e.target.value))}
                                disabled={isSaving}
                                min="1000"
                                max="10000"
                            />
                            <button 
                                onClick={handleSaveGoal}
                                disabled={isSaving}
                                className="px-3 py-1 bg-emerald-500 text-white rounded-lg text-xs font-bold hover:bg-emerald-600 transition-colors disabled:opacity-50"
                            >
                                {isSaving ? '...' : 'Save'}
                            </button>
                            <button 
                                onClick={() => { setIsEditing(false); setTempGoal(goal); }}
                                disabled={isSaving}
                                className="px-3 py-1 bg-slate-100 text-slate-600 rounded-lg text-xs font-bold hover:bg-slate-200 transition-colors disabled:opacity-50"
                            >
                                Cancel
                            </button>
                        </div>
                    ) : (
                        <div className="flex items-baseline gap-1.5">
                            <span className="text-2xl font-black text-slate-800">{consumed.toLocaleString()}</span>
                            <span className="text-sm text-slate-400 font-medium">/ {goal.toLocaleString()} kcal</span>
                        </div>
                    )}
                </div>
                <div className={`flex flex-col items-end px-3 py-2 rounded-xl text-xs font-black ${
                    isOver ? 'bg-red-50 text-red-600' : pct >= 80 ? 'bg-orange-50 text-orange-600' : 'bg-emerald-50 text-emerald-600'
                }`}>
                    <span className="text-lg">{isOver ? '⚠️' : pct >= 80 ? '🔥' : '✅'}</span>
                    <span>{isOver ? 'Over goal' : `${remaining} kcal left`}</span>
                </div>
            </div>

            {/* Progress bar */}
            <div className="h-3 bg-slate-100 rounded-full overflow-hidden">
                <div
                    className="h-full rounded-full transition-all duration-700"
                    style={{
                        width: `${pct}%`,
                        background: isOver
                            ? 'linear-gradient(90deg, #ef4444, #dc2626)'
                            : pct >= 80
                            ? 'linear-gradient(90deg, #f59e0b, #d97706)'
                            : 'linear-gradient(90deg, #10b981, #059669)',
                    }}
                />
            </div>

            {/* Breakdown labels */}
            <div className="mt-2 flex justify-between text-[10px] font-bold text-slate-400">
                <span>0</span>
                <span className="text-emerald-600">{Math.round(goal * 0.5).toLocaleString()} kcal</span>
                <span>{goal.toLocaleString()} kcal</span>
            </div>
        </Card>
    );
};

export default DailyGoalTracker;
