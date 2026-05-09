import React, { useState, useEffect } from 'react';
import Card from '../atoms/Card';
import { getAssignedUsers, getUserFullData, calculateDynamicCalories } from '../services/api';
import { FiTrendingUp, FiActivity, FiTarget, FiCalendar, FiCheckCircle } from 'react-icons/fi';



interface User {
    id: string;
    name: string;
    userId: string;
}

interface UserProgressData {
    id: string;
    name: string;
    weightProgress: number[];
    recentLogs: any[];
    dietPlan: { calories: number; protein: number; carbs: number; fats: number };
}

const NutritionistUserProgress: React.FC = () => {
    const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
    const [users, setUsers] = useState<User[]>([]);
    const [progress, setProgress] = useState<UserProgressData | null>(null);
    const [loading, setLoading] = useState<boolean>(false);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        const fetchUsers = async () => {
            try {
                const res = await getAssignedUsers();
                setUsers(res.data.assigned);
                if (res.data.assigned.length > 0) setSelectedUserId(res.data.assigned[0].userId);
            } catch (err) {
                console.error('Failed to load users:', err);
                setError('Failed to load user list.');
            }
        };
        fetchUsers();
    }, []);

    useEffect(() => {
        if (!selectedUserId) return;
        const fetchProgress = async () => {
            setLoading(true);
            setError(null);
            try {
                const { collection, query, where, getDocs, getDoc, doc, limit, orderBy } = await import('firebase/firestore');
                const { db } = await import('../firebase/config');

                // 1. Fetch User Profile
                const userSnap = await getDoc(doc(db, 'users', selectedUserId));
                if (!userSnap.exists()) throw new Error("User not found");
                const userData = userSnap.data();

                // 2. Fetch Recent Logs
                const logsQ = query(
                    collection(db, 'food_logs'),
                    where('userId', '==', selectedUserId),
                    orderBy('createdAt', 'desc'),
                    limit(10)
                );
                const logsSnap = await getDocs(logsQ);
                const logs = logsSnap.docs.map(d => {
                    const ld = d.data();
                    return {
                        id: d.id,
                        meal: ld.foodName || 'Meal',
                        calories: ld.calories || 0,
                        protein: ld.protein || 0,
                        carbs: ld.carbs || 0,
                        fats: ld.fats || 0,
                        date: ld.createdAt?.toDate ? ld.createdAt.toDate().toLocaleDateString() : 'Today'
                    };
                });

                // 3. Fetch Diet Plan
                const planQ = query(
                    collection(db, 'diet_recommendations'),
                    where('userId', '==', selectedUserId),
                    where('status', '==', 'approved'),
                    orderBy('createdAt', 'desc'),
                    limit(1)
                );
                const planSnap = await getDocs(planQ);
                const defaultCal = calculateDynamicCalories(userData);
                const dietPlan = !planSnap.empty ? planSnap.docs[0].data() : { calories: defaultCal, protein: 150, carbs: 200, fats: 65 };

                setProgress({
                    id: selectedUserId,
                    name: userData.name || 'User',
                    weightProgress: userData.weight ? [userData.weight] : [], // Use current weight as fallback
                    recentLogs: logs,
                    dietPlan: {
                        calories: dietPlan.calories || defaultCal,
                        protein: dietPlan.protein || 150,
                        carbs: dietPlan.carbs || 200,
                        fats: dietPlan.fats || 65
                    }
                });
            } catch (err) {
                console.error('Failed to load progress:', err);
                setError('Failed to load user progress.');
            } finally {
                setLoading(false);
            }
        };
        fetchProgress();
    }, [selectedUserId]);

    // Compute stats
    const computeCompliance = (): number => {
        if (!progress || !progress.recentLogs || progress.recentLogs.length === 0 || !progress.dietPlan?.calories) return 0;
        const goalCal = progress.dietPlan.calories;
        if (goalCal === 0) return 0;
        const withinRange = progress.recentLogs.filter(log => {
            const ratio = log.calories / goalCal;
            return ratio >= 0.8 && ratio <= 1.2;
        }).length;
        return Math.round((withinRange / progress.recentLogs.length) * 100);
    };

    const computeWeightChange = (): string => {
        if (!progress || !progress.weightProgress || progress.weightProgress.length < 2) {
            return progress?.weightProgress?.length === 1 ? `${progress.weightProgress[0]} kg` : '—';
        }
        const diff = progress.weightProgress[progress.weightProgress.length - 1] - progress.weightProgress[0];
        return `${diff > 0 ? '+' : ''}${diff.toFixed(1)} kg`;
    };

    const computeGoalSync = (): string => {
        const compliance = computeCompliance();
        if (compliance === 0) return 'No Data';
        if (compliance >= 70) return 'On Track';
        if (compliance >= 40) return 'Needs Focus';
        return 'Off Track';
    };

    return (
        <div className="space-y-8 animate-fade-in">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div>
                    <h2 className="text-2xl font-black text-slate-800 tracking-tight">User Progress</h2>
                    <p className="text-slate-500 text-sm font-medium mt-1">Track weight changes and diet compliance over time.</p>
                </div>
                {users.length > 0 && (
                    <select
                        className="bg-white border border-slate-200 rounded-xl px-4 py-2.5 text-sm font-bold shadow-sm focus:ring-2 focus:ring-emerald-500 outline-none"
                        value={selectedUserId || ''}
                        onChange={(e) => setSelectedUserId(e.target.value)}
                    >
                        {users.map(u => <option key={u.userId} value={u.userId}>{u.name}</option>)}
                    </select>
                )}
            </div>

            {error && <div className="p-4 bg-rose-50 text-rose-600 rounded-2xl border border-rose-100">{error}</div>}

            {loading ? (
                <div className="p-12 text-center"><div className="w-8 h-8 border-4 border-emerald-200 border-t-emerald-600 rounded-full animate-spin mx-auto"></div></div>
            ) : progress && (
                <div className="space-y-6">
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                        <Card className="p-6 border-emerald-100 flex items-center justify-between">
                            <div><p className="text-[10px] text-slate-400 font-black uppercase tracking-widest mb-1">Compliance</p><p className="text-2xl font-black text-emerald-600">{computeCompliance()}%</p></div>
                            <FiCheckCircle className="text-emerald-200 w-8 h-8" />
                        </Card>
                        <Card className="p-6 border-blue-100 flex items-center justify-between">
                            <div><p className="text-[10px] text-slate-400 font-black uppercase tracking-widest mb-1">Weight</p><p className="text-2xl font-black text-blue-600">{computeWeightChange()}</p></div>
                            <FiTrendingUp className="text-blue-200 w-8 h-8" />
                        </Card>
                        <Card className="p-6 border-purple-100 flex items-center justify-between">
                            <div><p className="text-[10px] text-slate-400 font-black uppercase tracking-widest mb-1">Goal Sync</p><p className="text-2xl font-black text-purple-600">{computeGoalSync()}</p></div>
                            <FiTarget className="text-purple-200 w-8 h-8" />
                        </Card>
                    </div>

                    <Card className="p-8 border-slate-100">
                        <h3 className="text-lg font-black text-slate-800 mb-6 flex items-center gap-2"><FiActivity className="text-emerald-500" />Weight History</h3>
                        <div className="h-64 bg-slate-50 rounded-2xl border-2 border-dashed border-slate-200 flex items-center justify-center">
                            <p className="text-slate-400 text-sm font-medium italic">
                                {progress.weightProgress.length > 0 ? `Weight data for ${progress.name}: ${progress.weightProgress.join(', ')} kg` : `No weight history for ${progress.name}`}
                            </p>
                        </div>
                    </Card>

                    <Card className="p-8 border-slate-100">
                        <h3 className="text-lg font-black text-slate-800 mb-6 flex items-center gap-2"><FiCalendar className="text-emerald-500" />Recent Logs</h3>
                        {progress.recentLogs.length > 0 ? (
                            <div className="space-y-2">
                                {progress.recentLogs.slice(0, 5).map(log => (
                                    <div key={log.id} className="flex items-center justify-between p-3 bg-slate-50 rounded-xl">
                                        <div><p className="text-sm font-bold text-slate-700">{log.meal}</p><p className="text-xs text-slate-400">{log.date}</p></div>
                                        <div className="text-right"><p className="text-sm font-black text-emerald-600">{log.calories} kcal</p><p className="text-[10px] text-slate-400">P:{log.protein}g C:{log.carbs}g F:{log.fats}g</p></div>
                                    </div>
                                ))}
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
