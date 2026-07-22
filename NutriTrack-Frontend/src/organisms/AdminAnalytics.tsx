import React, { useState, useEffect, useMemo } from 'react';
import Card from '../atoms/Card';
import { db } from '../firebase/config';
import { collection, onSnapshot } from 'firebase/firestore';
import {
    FiUsers,
    FiActivity,
    FiClipboard,
    FiCheckCircle,
    FiClock,
    FiTrendingUp,
    FiAward,
    FiSliders,
    FiHeart,
    FiShield
} from 'react-icons/fi';
import {
    ResponsiveContainer,
    AreaChart,
    Area,
    LineChart,
    Line,
    BarChart,
    Bar,
    PieChart,
    Pie,
    Cell,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    Legend
} from 'recharts';

const COLORS = ['#10B981', '#3B82F6', '#8B5CF6', '#EF4444', '#F59E0B', '#06B6D4'];

const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
        return (
            <div className="bg-white/95 backdrop-blur-md p-3 rounded-2xl border border-slate-100 shadow-xl">
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">{label}</p>
                {payload.map((pld: any, index: number) => (
                    <p key={index} className="text-sm font-bold" style={{ color: pld.color || pld.fill }}>
                        {pld.name}: {pld.value}
                    </p>
                ))}
            </div>
        );
    }
    return null;
};

const AdminAnalytics: React.FC = () => {
    const [users, setUsers] = useState<any[]>([]);
    const [foodLogs, setFoodLogs] = useState<any[]>([]);
    const [requests, setRequests] = useState<any[]>([]);
    const [recommendations, setRecommendations] = useState<any[]>([]);
    const [loading, setLoading] = useState<boolean>(true);
    const [error, setError] = useState<string>('');
    const [growthPeriod, setGrowthPeriod] = useState<'daily' | 'weekly' | 'monthly'>('daily');
    const [growthMetric, setGrowthMetric] = useState<'cumulative' | 'registrations'>('cumulative');
    const [calorieDays, setCalorieDays] = useState<7 | 30>(7);

    useEffect(() => {
        let isMounted = true;

        const unsubUsers = onSnapshot(collection(db, 'users'), (snapshot) => {
            if (!isMounted) return;
            const list = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            setUsers(list);
            setLoading(false);
        }, (err) => {
            console.error("Users subscription failed", err);
            if (isMounted) setError("Failed to stream real-time user data.");
        });

        const unsubFoodLogs = onSnapshot(collection(db, 'food_logs'), (snapshot) => {
            if (!isMounted) return;
            const list = snapshot.docs.map(doc => {
                const data = doc.data();
                return {
                    id: doc.id,
                    ...data,
                    createdAt: data.createdAt?.toDate() || new Date()
                };
            });
            setFoodLogs(list);
        }, (err) => {
            console.error("Food logs subscription failed", err);
        });

        const unsubRequests = onSnapshot(collection(db, 'nutritionist_requests'), (snapshot) => {
            if (!isMounted) return;
            const list = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            setRequests(list);
        }, (err) => {
            console.error("Requests subscription failed", err);
        });

        const unsubRecommendations = onSnapshot(collection(db, 'diet_recommendations'), (snapshot) => {
            if (!isMounted) return;
            const list = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            setRecommendations(list);
        }, (err) => {
            console.error("Recommendations subscription failed", err);
        });

        return () => {
            isMounted = false;
            unsubUsers();
            unsubFoodLogs();
            unsubRequests();
            unsubRecommendations();
        };
    }, []);

    // --- KPI Aggregations ---
    const kpis = useMemo(() => {
        const totalUsers = users.filter(u => u.role === 'user').length;
        const totalNutritionists = users.filter(u => u.role === 'nutritionist').length;
        const totalLogs = foodLogs.length;

        // System Wide Average Calories per Day per Active User
        const calorieSums: Record<string, { total: number; users: Set<string> }> = {};
        foodLogs.forEach(log => {
            const dateStr = log.createdAt instanceof Date 
                ? log.createdAt.toISOString().split('T')[0] 
                : new Date(log.createdAt).toISOString().split('T')[0];
            
            if (!calorieSums[dateStr]) {
                calorieSums[dateStr] = { total: 0, users: new Set() };
            }
            calorieSums[dateStr].total += (log.calories || 0);
            calorieSums[dateStr].users.add(log.userId);
        });

        const days = Object.keys(calorieSums);
        let dailyAverageTotal = 0;
        days.forEach(day => {
            const activeCount = calorieSums[day].users.size;
            if (activeCount > 0) {
                dailyAverageTotal += (calorieSums[day].total / activeCount);
            }
        });

        const systemWideAvgCalories = days.length > 0 ? Math.round(dailyAverageTotal / days.length) : 0;
        const pendingRequests = requests.filter(r => r.status === 'pending').length;
        const totalRecommendations = recommendations.length;

        return {
            totalUsers,
            totalNutritionists,
            totalLogs,
            systemWideAvgCalories,
            pendingRequests,
            totalRecommendations
        };
    }, [users, foodLogs, requests, recommendations]);

    // --- Chart Data Memoizations ---

    // 1. User Growth Trend (supports daily, weekly, monthly / cumulative vs registrations)
    const growthData = useMemo(() => {
        const nonAdmins = users.filter(u => u.role !== 'admin');
        
        const getStartOfWeek = (d: Date) => {
            const day = d.getDay();
            const diff = d.getDate() - day + (day === 0 ? -6 : 1); // adjust when day is sunday
            const nd = new Date(d);
            nd.setDate(diff);
            return nd.toISOString().split('T')[0];
        };

        const dailyGroups: Record<string, number> = {};
        const weeklyGroups: Record<string, number> = {};
        const monthlyGroups: Record<string, number> = {};

        nonAdmins.forEach(u => {
            const date = u.createdAt?.toDate?.() || (u.createdAt ? new Date(u.createdAt) : new Date());
            const dateStr = date.toISOString().split('T')[0];
            const weekStr = getStartOfWeek(date);
            const monthStr = dateStr.substring(0, 7); // YYYY-MM

            dailyGroups[dateStr] = (dailyGroups[dateStr] || 0) + 1;
            weeklyGroups[weekStr] = (weeklyGroups[weekStr] || 0) + 1;
            monthlyGroups[monthStr] = (monthlyGroups[monthStr] || 0) + 1;
        });

        const buildSeries = (groups: Record<string, number>) => {
            const sortedKeys = Object.keys(groups).sort();
            let cumulative = 0;
            return sortedKeys.map(key => {
                cumulative += groups[key];
                return {
                    date: key,
                    Registrations: groups[key],
                    'Total Users': cumulative
                };
            });
        };

        return {
            daily: buildSeries(dailyGroups),
            weekly: buildSeries(weeklyGroups),
            monthly: buildSeries(monthlyGroups)
        };
    }, [users]);

    const activeGrowthSeries = useMemo(() => {
        return growthData[growthPeriod] || [];
    }, [growthData, growthPeriod]);

    // 2. User Role Distribution
    const roleData = useMemo(() => {
        const counts = { user: 0, nutritionist: 0, admin: 0 };
        users.forEach(u => {
            const r = (u.role || 'user').toLowerCase();
            if (r === 'admin') counts.admin++;
            else if (r === 'nutritionist') counts.nutritionist++;
            else counts.user++;
        });
        return [
            { name: 'Users', value: counts.user, color: '#10B981' },
            { name: 'Nutritionists', value: counts.nutritionist, color: '#3B82F6' },
            { name: 'Admins', value: counts.admin, color: '#8B5CF6' }
        ];
    }, [users]);

    // 3. Average Daily Calorie Intake
    const dailyCalorieData = useMemo(() => {
        const logsByDate: Record<string, { totalCalories: number; users: Set<string> }> = {};
        
        for (let i = 0; i < calorieDays; i++) {
            const d = new Date();
            d.setDate(d.getDate() - i);
            const dateStr = d.toISOString().split('T')[0];
            logsByDate[dateStr] = { totalCalories: 0, users: new Set() };
        }

        foodLogs.forEach(log => {
            const date = log.createdAt instanceof Date ? log.createdAt : new Date(log.createdAt);
            const dateStr = date.toISOString().split('T')[0];
            if (logsByDate[dateStr]) {
                logsByDate[dateStr].totalCalories += (log.calories || 0);
                logsByDate[dateStr].users.add(log.userId);
            }
        });

        return Object.keys(logsByDate).sort().map(dateStr => {
            const item = logsByDate[dateStr];
            const activeUsersCount = item.users.size;
            const avgCalories = activeUsersCount > 0 ? Math.round(item.totalCalories / activeUsersCount) : 0;
            return {
                date: dateStr,
                Calories: avgCalories
            };
        });
    }, [foodLogs, calorieDays]);

    // 4. Macronutrient Distribution
    const macroData = useMemo(() => {
        let totalP = 0;
        let totalC = 0;
        let totalF = 0;
        
        foodLogs.forEach(log => {
            totalP += (log.protein || 0);
            totalC += (log.carbs || 0);
            totalF += (log.fats || 0);
        });
        
        const pKcal = totalP * 4;
        const cKcal = totalC * 4;
        const fKcal = totalF * 9;
        const totalKcal = pKcal + cKcal + fKcal;
        
        if (totalKcal === 0) {
            return [
                { name: 'Protein', value: 0, color: '#3B82F6' },
                { name: 'Carbs', value: 0, color: '#10B981' },
                { name: 'Fats', value: 0, color: '#EF4444' }
            ];
        }
        
        return [
            { name: 'Protein', value: Math.round((pKcal / totalKcal) * 100), color: '#3B82F6' },
            { name: 'Carbs', value: Math.round((cKcal / totalKcal) * 100), color: '#10B981' },
            { name: 'Fats', value: Math.round((fKcal / totalKcal) * 100), color: '#EF4444' }
        ];
    }, [foodLogs]);

    // 5. Food Logging Activity
    const loggingActivityData = useMemo(() => {
        const activityByDate: Record<string, number> = {};
        const daysLimit = 30;
        
        for (let i = 0; i < daysLimit; i++) {
            const d = new Date();
            d.setDate(d.getDate() - i);
            const dateStr = d.toISOString().split('T')[0];
            activityByDate[dateStr] = 0;
        }

        foodLogs.forEach(log => {
            const date = log.createdAt instanceof Date ? log.createdAt : new Date(log.createdAt);
            const dateStr = date.toISOString().split('T')[0];
            if (activityByDate[dateStr] !== undefined) {
                activityByDate[dateStr]++;
            }
        });

        return Object.keys(activityByDate).sort().map(dateStr => ({
            date: dateStr,
            Logs: activityByDate[dateStr]
        }));
    }, [foodLogs]);

    // 6. Top Consumed Foods
    const topFoodsData = useMemo(() => {
        const counts: Record<string, number> = {};
        foodLogs.forEach(log => {
            const name = (log.foodName || log.food?.name || '').trim();
            if (name) {
                const normalized = name.charAt(0).toUpperCase() + name.slice(1).toLowerCase();
                counts[normalized] = (counts[normalized] || 0) + 1;
            }
        });

        return Object.entries(counts)
            .map(([name, value]) => ({ name, Logs: value }))
            .sort((a, b) => b.Logs - a.Logs)
            .slice(0, 10);
    }, [foodLogs]);

    // 7. Fitness Goal Distribution
    const fitnessGoalData = useMemo(() => {
        const counts = { 'Weight Loss': 0, 'Weight Gain': 0, 'Muscle Building': 0, 'General Health': 0 };
        users.forEach(u => {
            if (u.role !== 'user') return;
            const goal = (u.fitnessGoal || '').toLowerCase();
            if (goal.includes('lose') || goal.includes('slimming') || goal.includes('deficit')) {
                counts['Weight Loss']++;
            } else if (goal.includes('gain') || goal.includes('bulking')) {
                counts['Weight Gain']++;
            } else if (goal.includes('muscle') || goal.includes('build') || goal.includes('strength')) {
                counts['Muscle Building']++;
            } else {
                counts['General Health']++;
            }
        });

        return Object.entries(counts).map(([name, value]) => ({ name, Users: value }));
    }, [users]);

    // 8. Health Condition Distribution
    const healthConditionData = useMemo(() => {
        const counts = { 'Diabetes': 0, 'Hypertension': 0, 'Cholesterol': 0, 'None': 0 };
        users.forEach(u => {
            if (u.role !== 'user') return;
            const cond = (u.healthCondition || 'none').toLowerCase();
            if (cond.includes('diabetes') || cond.includes('diabetic')) {
                counts['Diabetes']++;
            } else if (cond.includes('hypertension') || cond.includes('blood pressure')) {
                counts['Hypertension']++;
            } else if (cond.includes('cholesterol')) {
                counts['Cholesterol']++;
            } else {
                counts['None']++;
            }
        });

        return Object.entries(counts).map(([name, value]) => ({ name, Users: value }));
    }, [users]);

    // 9. Nutritionist Request Analytics
    const requestsData = useMemo(() => {
        const counts = { pending: 0, accepted: 0, rejected: 0 };
        requests.forEach(r => {
            const status = (r.status || 'pending').toLowerCase();
            if (status === 'accepted') counts.accepted++;
            else if (status === 'rejected') counts.rejected++;
            else counts.pending++;
        });
        return [
            { name: 'Pending', value: counts.pending, color: '#F59E0B' },
            { name: 'Accepted', value: counts.accepted, color: '#10B981' },
            { name: 'Rejected', value: counts.rejected, color: '#EF4444' }
        ];
    }, [requests]);

    // 10. Diet Recommendation Usage
    const recommendationStats = useMemo(() => {
        const totalGenerated = recommendations.length;
        const totalApproved = recommendations.filter(r => r.status === 'approved').length;
        const totalUserSelected = foodLogs.filter(log => log.source === 'ai').length;
        
        return {
            totalGenerated,
            totalApproved,
            totalUserSelected
        };
    }, [recommendations, foodLogs]);

    if (loading) {
        return (
            <div className="flex justify-center items-center h-64">
                <div className="w-10 h-10 border-4 border-emerald-200 border-t-emerald-600 rounded-full animate-spin"></div>
            </div>
        );
    }

    const statCards = [
        { label: 'Total Users', value: kpis.totalUsers, icon: FiUsers, color: 'from-blue-500 to-indigo-600' },
        { label: 'Total Nutritionists', value: kpis.totalNutritionists, icon: FiActivity, color: 'from-emerald-500 to-teal-600' },
        { label: 'Total Food Logs', value: kpis.totalLogs, icon: FiClipboard, color: 'from-orange-500 to-amber-600' },
        { label: 'Avg Daily Calories', value: `${kpis.systemWideAvgCalories} kcal`, icon: FiTrendingUp, color: 'from-cyan-500 to-blue-600' },
        { label: 'Pending Requests', value: kpis.pendingRequests, icon: FiClock, color: 'from-red-500 to-rose-600' },
        { label: 'Total Diet Recommendations', value: kpis.totalRecommendations, icon: FiCheckCircle, color: 'from-purple-500 to-pink-600' },
    ];

    return (
        <div className="space-y-8 animate-fade-in pb-12">
            <div>
                <h2 className="text-2xl font-black text-slate-800 tracking-tight">System Analytics</h2>
                <p className="text-slate-500 text-sm font-medium mt-1">Real-time platform performance, user engagement, and health insights.</p>
            </div>

            {error && (
                <div className="p-4 bg-red-50 text-red-600 rounded-2xl border border-red-200 text-sm font-medium">
                    {error}
                </div>
            )}

            {/* KPI Cards Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {statCards.map((card, idx) => (
                    <Card key={idx} className={`p-6 bg-gradient-to-br ${card.color} text-white border-0 shadow-lg group hover:scale-[1.02] transition-transform`}>
                        <div className="flex justify-between items-start">
                            <div>
                                <p className="text-white/80 text-xs font-bold uppercase tracking-widest mb-1">{card.label}</p>
                                <p className="text-4xl font-black">{card.value}</p>
                            </div>
                            <div className="p-3 bg-white/20 rounded-xl backdrop-blur-md group-hover:bg-white/30 transition-colors">
                                <card.icon className="w-6 h-6" />
                            </div>
                        </div>
                    </Card>
                ))}
            </div>

            {/* Visualizations Grid */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                
                {/* 1. User Growth Trend */}
                <Card className="p-6">
                    <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
                        <div>
                            <h3 className="text-base font-bold text-slate-800">User Growth Trend</h3>
                            <p className="text-xs text-slate-400 font-medium">Registered users over time</p>
                        </div>
                        <div className="flex flex-wrap gap-2">
                            <select
                                value={growthPeriod}
                                onChange={(e: any) => setGrowthPeriod(e.target.value)}
                                className="px-3 py-1 text-xs font-bold rounded-full border border-slate-200 bg-white text-slate-600 focus:outline-none"
                            >
                                <option value="daily">Daily</option>
                                <option value="weekly">Weekly</option>
                                <option value="monthly">Monthly</option>
                            </select>
                            <button
                                onClick={() => setGrowthMetric('cumulative')}
                                className={`px-3 py-1 text-xs font-bold rounded-full border ${growthMetric === 'cumulative' ? 'bg-indigo-550 text-white border-indigo-550' : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'}`}
                            >
                                Cumulative
                            </button>
                            <button
                                onClick={() => setGrowthMetric('registrations')}
                                className={`px-3 py-1 text-xs font-bold rounded-full border ${growthMetric === 'registrations' ? 'bg-indigo-550 text-white border-indigo-550' : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'}`}
                            >
                                Registrations
                            </button>
                        </div>
                    </div>
                    <div className="h-[300px]">
                        <ResponsiveContainer width="100%" height="100%">
                            <AreaChart data={activeGrowthSeries} margin={{ left: -10, right: 10 }}>
                                <defs>
                                    <linearGradient id="growthColor" x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="5%" stopColor="#6366F1" stopOpacity={0.2}/>
                                        <stop offset="95%" stopColor="#6366F1" stopOpacity={0}/>
                                    </linearGradient>
                                </defs>
                                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#F1F5F9" />
                                <XAxis dataKey="date" stroke="#94A3B8" fontSize={10} tickLine={false} />
                                <YAxis stroke="#94A3B8" fontSize={10} tickLine={false} />
                                <Tooltip content={<CustomTooltip />} />
                                <Area
                                    type="monotone"
                                    dataKey={growthMetric === 'cumulative' ? 'Total Users' : 'Registrations'}
                                    stroke="#6366F1"
                                    strokeWidth={3}
                                    fillOpacity={1}
                                    fill="url(#growthColor)"
                                />
                            </AreaChart>
                        </ResponsiveContainer>
                    </div>
                </Card>

                {/* 2. User Role Distribution */}
                <Card className="p-6">
                    <div>
                        <h3 className="text-base font-bold text-slate-800">User Role Distribution</h3>
                        <p className="text-xs text-slate-400 font-medium mb-6">Platform user composition</p>
                    </div>
                    <div className="h-[300px] flex items-center justify-center relative">
                        <ResponsiveContainer width="100%" height="100%">
                            <PieChart>
                                <Pie
                                    data={roleData}
                                    cx="50%"
                                    cy="50%"
                                    innerRadius={70}
                                    outerRadius={95}
                                    paddingAngle={3}
                                    dataKey="value"
                                >
                                    {roleData.map((entry, index) => (
                                        <Cell key={`cell-${index}`} fill={entry.color} />
                                    ))}
                                </Pie>
                                <Tooltip content={<CustomTooltip />} />
                                <Legend verticalAlign="bottom" iconType="circle" />
                            </PieChart>
                        </ResponsiveContainer>
                    </div>
                </Card>

                {/* 3. Average Daily Calorie Intake */}
                <Card className="p-6">
                    <div className="flex justify-between items-center mb-6">
                        <div>
                            <h3 className="text-base font-bold text-slate-800">Average Daily Calorie Intake</h3>
                            <p className="text-xs text-slate-400 font-medium">Average calories consumed per day per active user</p>
                        </div>
                        <div className="flex gap-2">
                            <button
                                onClick={() => setCalorieDays(7)}
                                className={`px-3 py-1 text-xs font-bold rounded-full border ${calorieDays === 7 ? 'bg-emerald-550 text-white border-emerald-550' : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'}`}
                            >
                                7 Days
                            </button>
                            <button
                                onClick={() => setCalorieDays(30)}
                                className={`px-3 py-1 text-xs font-bold rounded-full border ${calorieDays === 30 ? 'bg-emerald-550 text-white border-emerald-550' : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'}`}
                            >
                                30 Days
                            </button>
                        </div>
                    </div>
                    <div className="h-[300px]">
                        <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={dailyCalorieData} margin={{ left: -10, right: 10 }}>
                                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#F1F5F9" />
                                <XAxis dataKey="date" stroke="#94A3B8" fontSize={10} tickLine={false} />
                                <YAxis stroke="#94A3B8" fontSize={10} tickLine={false} />
                                <Tooltip content={<CustomTooltip />} />
                                <Bar dataKey="Calories" fill="#10B981" radius={[8, 8, 0, 0]} maxBarSize={40} />
                            </BarChart>
                        </ResponsiveContainer>
                    </div>
                </Card>

                {/* 4. Macronutrient Distribution */}
                <Card className="p-6">
                    <div>
                        <h3 className="text-base font-bold text-slate-800">Macronutrient Distribution</h3>
                        <p className="text-xs text-slate-400 font-medium mb-6">Average macro percentage breakdown across all tracked meals</p>
                    </div>
                    <div className="h-[300px]">
                        <ResponsiveContainer width="100%" height="100%">
                            <PieChart>
                                <Pie
                                    data={macroData}
                                    cx="50%"
                                    cy="50%"
                                    outerRadius={95}
                                    label={({ name, value }) => `${name}: ${value}%`}
                                    dataKey="value"
                                >
                                    {macroData.map((entry, index) => (
                                        <Cell key={`cell-${index}`} fill={entry.color} />
                                    ))}
                                </Pie>
                                <Tooltip content={<CustomTooltip />} />
                                <Legend verticalAlign="bottom" iconType="circle" />
                            </PieChart>
                        </ResponsiveContainer>
                    </div>
                </Card>

                {/* 5. Food Logging Activity */}
                <Card className="p-6">
                    <div>
                        <h3 className="text-base font-bold text-slate-800">Food Logging Activity</h3>
                        <p className="text-xs text-slate-400 font-medium mb-6">Daily user logging activity count over past 30 days</p>
                    </div>
                    <div className="h-[300px]">
                        <ResponsiveContainer width="100%" height="100%">
                            <LineChart data={loggingActivityData} margin={{ left: -10, right: 10 }}>
                                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#F1F5F9" />
                                <XAxis dataKey="date" stroke="#94A3B8" fontSize={10} tickLine={false} />
                                <YAxis stroke="#94A3B8" fontSize={10} tickLine={false} />
                                <Tooltip content={<CustomTooltip />} />
                                <Line type="monotone" dataKey="Logs" stroke="#EC4899" strokeWidth={3} dot={false} />
                            </LineChart>
                        </ResponsiveContainer>
                    </div>
                </Card>

                {/* 6. Top Consumed Foods */}
                <Card className="p-6">
                    <div>
                        <h3 className="text-base font-bold text-slate-800">Top Consumed Foods</h3>
                        <p className="text-xs text-slate-400 font-medium mb-6">Top 10 most logged foods by users</p>
                    </div>
                    <div className="h-[300px]">
                        <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={topFoodsData} layout="vertical" margin={{ left: 20, right: 10 }}>
                                <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#F1F5F9" />
                                <XAxis type="number" stroke="#94A3B8" fontSize={10} tickLine={false} />
                                <YAxis dataKey="name" type="category" stroke="#94A3B8" fontSize={10} tickLine={false} width={80} />
                                <Tooltip content={<CustomTooltip />} />
                                <Bar dataKey="Logs" fill="#F59E0B" radius={[0, 8, 8, 0]} maxBarSize={20} />
                            </BarChart>
                        </ResponsiveContainer>
                    </div>
                </Card>

                {/* 7. Fitness Goal Distribution */}
                <Card className="p-6">
                    <div>
                        <h3 className="text-base font-bold text-slate-800">Fitness Goal Distribution</h3>
                        <p className="text-xs text-slate-400 font-medium mb-6">User fitness profile demographics</p>
                    </div>
                    <div className="h-[300px]">
                        <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={fitnessGoalData} margin={{ left: -10, right: 10 }}>
                                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#F1F5F9" />
                                <XAxis dataKey="name" stroke="#94A3B8" fontSize={10} tickLine={false} />
                                <YAxis stroke="#94A3B8" fontSize={10} tickLine={false} />
                                <Tooltip content={<CustomTooltip />} />
                                <Bar dataKey="Users" fill="#8B5CF6" radius={[8, 8, 0, 0]} maxBarSize={40} />
                            </BarChart>
                        </ResponsiveContainer>
                    </div>
                </Card>

                {/* 8. Health Condition Distribution */}
                <Card className="p-6">
                    <div>
                        <h3 className="text-base font-bold text-slate-800">Health Condition Distribution</h3>
                        <p className="text-xs text-slate-400 font-medium mb-6">Registered user health demographics</p>
                    </div>
                    <div className="h-[300px]">
                        <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={healthConditionData} margin={{ left: -10, right: 10 }}>
                                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#F1F5F9" />
                                <XAxis dataKey="name" stroke="#94A3B8" fontSize={10} tickLine={false} />
                                <YAxis stroke="#94A3B8" fontSize={10} tickLine={false} />
                                <Tooltip content={<CustomTooltip />} />
                                <Bar dataKey="Users" fill="#EF4444" radius={[8, 8, 0, 0]} maxBarSize={40} />
                            </BarChart>
                        </ResponsiveContainer>
                    </div>
                </Card>

                {/* 9. Nutritionist Request Analytics */}
                <Card className="p-6">
                    <div>
                        <h3 className="text-base font-bold text-slate-800">Nutritionist Request Analytics</h3>
                        <p className="text-xs text-slate-400 font-medium mb-6">Status of user connections requests</p>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 h-[300px] items-center">
                        <div className="h-full">
                            <ResponsiveContainer width="100%" height="100%">
                                <PieChart>
                                    <Pie
                                        data={requestsData}
                                        cx="50%"
                                        cy="50%"
                                        innerRadius={60}
                                        outerRadius={85}
                                        paddingAngle={3}
                                        dataKey="value"
                                    >
                                        {requestsData.map((entry, index) => (
                                            <Cell key={`cell-${index}`} fill={entry.color} />
                                        ))}
                                    </Pie>
                                    <Tooltip content={<CustomTooltip />} />
                                </PieChart>
                            </ResponsiveContainer>
                        </div>
                        <div className="space-y-3">
                            <div className="flex justify-between items-center p-3 rounded-2xl bg-slate-50 border border-slate-100">
                                <span className="text-xs font-bold text-slate-500">Total Requests</span>
                                <span className="text-sm font-black text-slate-800">{requests.length}</span>
                            </div>
                            {requestsData.map((item, idx) => (
                                <div key={idx} className="flex justify-between items-center p-3 rounded-2xl bg-slate-50 border border-slate-100">
                                    <div className="flex items-center gap-2">
                                        <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: item.color }} />
                                        <span className="text-xs font-bold text-slate-500 capitalize">{item.name}</span>
                                    </div>
                                    <span className="text-sm font-black text-slate-800">{item.value}</span>
                                </div>
                            ))}
                        </div>
                    </div>
                </Card>

                {/* 10. Diet Recommendation Usage */}
                <Card className="p-6 flex flex-col justify-between">
                    <div>
                        <h3 className="text-base font-bold text-slate-800">Diet Recommendation Usage</h3>
                        <p className="text-xs text-slate-400 font-medium mb-6">AI generated vs user interaction statistics</p>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 h-[300px] items-center">
                        <Card className="p-4 bg-violet-50/55 border-violet-100 text-center flex flex-col justify-center h-48">
                            <FiAward className="w-8 h-8 text-violet-550 mx-auto mb-3" />
                            <p className="text-[10px] font-bold uppercase tracking-wider text-violet-650">Plans Generated</p>
                            <p className="text-3xl font-black text-violet-900 mt-1">{recommendationStats.totalGenerated}</p>
                        </Card>
                        <Card className="p-4 bg-emerald-50/55 border-emerald-100 text-center flex flex-col justify-center h-48">
                            <FiShield className="w-8 h-8 text-emerald-550 mx-auto mb-3" />
                            <p className="text-[10px] font-bold uppercase tracking-wider text-emerald-650">Plans Approved</p>
                            <p className="text-3xl font-black text-emerald-900 mt-1">{recommendationStats.totalApproved}</p>
                        </Card>
                        <Card className="p-4 bg-blue-50/55 border-blue-100 text-center flex flex-col justify-center h-48">
                            <FiSliders className="w-8 h-8 text-blue-550 mx-auto mb-3" />
                            <p className="text-[10px] font-bold uppercase tracking-wider text-blue-650">Selected Meals</p>
                            <p className="text-3xl font-black text-blue-900 mt-1">{recommendationStats.totalUserSelected}</p>
                        </Card>
                    </div>
                </Card>

            </div>
        </div>
    );
};

export default AdminAnalytics;
