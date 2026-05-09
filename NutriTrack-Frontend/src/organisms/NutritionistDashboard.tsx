import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import Card from '../atoms/Card';
import { useAuth } from '../context/AuthContext';
import {
    FiUsers, FiInbox, FiFileText, FiActivity,
    FiArrowRight, FiCheckSquare, FiMessageSquare, FiFilePlus
} from 'react-icons/fi';


interface DashboardStats {
    assignedUsers: number;
    pendingRequests: number;
    activePlans: number;
    recentActivityCount: number;
}

interface ActivityItem {
    id: number;
    type: string;
    userName: string;
    action: string;
    time: string;
    icon: string;
}

interface DashboardData {
    stats: DashboardStats;
    recentActivity: ActivityItem[];
}

// ---- Component ----

const NutritionistDashboard: React.FC = () => {
    const [loading, setLoading] = useState<boolean>(true);
    const navigate = useNavigate();

    const { user } = useAuth();
    const [stats, setStats] = useState<DashboardStats>({
        assignedUsers: 0,
        pendingRequests: 0,
        activePlans: 0,
        recentActivityCount: 0
    });
    const [recentActivity, setRecentActivity] = useState<ActivityItem[]>([]);

    useEffect(() => {
        if (!user) return;

        const fetchData = async () => {
            setLoading(true);
            try {
                const { collection, query, where, getDocs, getDoc, doc, limit, orderBy } = await import('firebase/firestore');
                const { db } = await import('../firebase/config');

                // 1. Fetch assigned users count
                const assignedQ = query(
                    collection(db, 'nutritionist_requests'),
                    where('nutritionistId', '==', user.uid),
                    where('status', '==', 'accepted')
                );
                const assignedSnap = await getDocs(assignedQ);
                const assignedCount = assignedSnap.size;

                // 2. Fetch pending requests count
                const pendingQ = query(
                    collection(db, 'nutritionist_requests'),
                    where('nutritionistId', '==', user.uid),
                    where('status', '==', 'pending')
                );
                const pendingSnap = await getDocs(pendingQ);
                const pendingCount = pendingSnap.size;

                // 3. Fetch active plans (approved recommendations)
                const plansQ = query(
                    collection(db, 'diet_recommendations'),
                    where('nutritionistId', '==', user.uid),
                    where('status', '==', 'approved')
                );
                const plansSnap = await getDocs(plansQ);
                const activePlansCount = plansSnap.size;

                // 4. Fetch recent activity (food logs from assigned users)
                const userIds = assignedSnap.docs.map(d => d.data().userId).filter(Boolean);
                let activity: ActivityItem[] = [];
                
                if (userIds.length > 0) {
                    const logsQ = query(
                        collection(db, 'food_logs'),
                        where('userId', '==', userIds.slice(0, 10)), // Limit to first 10 assigned users for activity
                        orderBy('createdAt', 'desc'),
                        limit(5)
                    );
                    const logsSnap = await getDocs(logsQ);
                    
                    const activityPromises = logsSnap.docs.map(async (logDoc, idx) => {
                        const ld = logDoc.data();
                        const userDoc = await getDoc(doc(db, 'users', ld.userId));
                        const userName = userDoc.exists() ? userDoc.data().name : 'User';
                        const ts = ld.createdAt?.toDate?.() || new Date();
                        
                        return {
                            id: idx + 1,
                            type: 'food_log',
                            userName,
                            action: `logged ${ld.foodName || 'a meal'} (${ld.calories || 0} kcal)`,
                            time: ts.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
                            icon: '📸'
                        };
                    });
                    activity = await Promise.all(activityPromises);
                }

                setStats({
                    assignedUsers: assignedCount,
                    pendingRequests: pendingCount,
                    activePlans: activePlansCount,
                    recentActivityCount: activity.length
                });
                setRecentActivity(activity);

            } catch (err) {
                console.error('Failed to load dashboard', err);
            } finally {
                setLoading(false);
            }
        };

        fetchData();
    }, [user]);

    if (loading) {
        return (
            <div className="p-12 text-center">
                <div className="w-10 h-10 border-4 border-emerald-200 border-t-emerald-600 rounded-full animate-spin mx-auto"></div>
            </div>
        );
    }

    const statCards = [
        {
            label: 'Assigned Users',
            value: stats.assignedUsers,
            icon: FiUsers,
            gradient: 'from-emerald-500 to-teal-600',
            bgIcon: 'bg-emerald-100 text-emerald-600',
        },
        {
            label: 'Pending Requests',
            value: stats.pendingRequests,
            icon: FiInbox,
            gradient: 'from-orange-500 to-amber-500',
            bgIcon: 'bg-orange-100 text-orange-600',
        },
        {
            label: 'Active Plans',
            value: stats.activePlans,
            icon: FiFileText,
            gradient: 'from-blue-500 to-indigo-600',
            bgIcon: 'bg-blue-100 text-blue-600',
        },
        {
            label: 'Recent Activity',
            value: stats.recentActivityCount,
            icon: FiActivity,
            gradient: 'from-purple-500 to-violet-600',
            bgIcon: 'bg-purple-100 text-purple-600',
        },
    ];

    const quickActions = [
        { label: 'Manage Users', to: '/nutritionist-dashboard/users', icon: FiUsers, color: 'text-emerald-600 bg-emerald-50 hover:bg-emerald-100' },
        { label: 'Review Food Logs', to: '/nutritionist-dashboard/review-logs', icon: FiCheckSquare, color: 'text-blue-600 bg-blue-50 hover:bg-blue-100' },
        { label: 'Diet Plans', to: '/nutritionist-dashboard/diet-plans', icon: FiFilePlus, color: 'text-orange-600 bg-orange-50 hover:bg-orange-100' },
        { label: 'Messages', to: '/nutritionist-dashboard/chat', icon: FiMessageSquare, color: 'text-purple-600 bg-purple-50 hover:bg-purple-100' },
    ];

    return (
        <div className="space-y-8 animate-fade-in">
            {/* Header */}
            <div>
                <h1 className="text-2xl md:text-3xl font-black text-slate-800 tracking-tight">
                    Dashboard Overview 👨‍⚕️
                </h1>
                <p className="text-slate-500 mt-1 text-sm font-medium">
                    Welcome back! Here's a snapshot of your practice today.
                </p>
            </div>

            {/* Stats Cards */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                {statCards.map((card) => (
                    <Card key={card.label} className="relative overflow-hidden p-5 hover:-translate-y-1 transition-all duration-300 group">
                        <div className={`absolute top-0 right-0 w-24 h-24 bg-gradient-to-br ${card.gradient} rounded-full opacity-10 -translate-y-8 translate-x-8 group-hover:scale-150 transition-transform duration-500`}></div>
                        <div className="relative z-10">
                            <div className={`w-10 h-10 rounded-xl ${card.bgIcon} flex items-center justify-center mb-3`}>
                                <card.icon className="w-5 h-5" />
                            </div>
                            <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">{card.label}</p>
                            <p className="text-3xl font-black text-slate-800 mt-1">{card.value}</p>
                        </div>
                    </Card>
                ))}
            </div>

            {/* Two-column layout: Activity Feed + Quick Actions */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Activity Feed (2/3) */}
                <Card className="lg:col-span-2 p-6">
                    <h3 className="text-sm font-bold text-slate-700 uppercase tracking-wider mb-5 flex items-center gap-2">
                        <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
                        Recent Activity
                    </h3>
                    <div className="space-y-1">
                        {recentActivity.map((item) => (
                            <div
                                key={item.id}
                                className="flex items-center gap-4 p-3.5 rounded-xl hover:bg-slate-50 transition-colors duration-200 group"
                            >
                                <div className="w-10 h-10 rounded-xl bg-slate-100 flex items-center justify-center text-lg flex-shrink-0 group-hover:scale-110 transition-transform duration-200">
                                    {item.icon}
                                </div>
                                <div className="flex-1 min-w-0">
                                    <p className="text-sm text-slate-800 truncate">
                                        <span className="font-bold">{item.userName}</span>{' '}
                                        <span className="text-slate-500">{item.action}</span>
                                    </p>
                                    <p className="text-xs text-slate-400 font-medium mt-0.5">{item.time}</p>
                                </div>
                            </div>
                        ))}
                    </div>
                </Card>

                {/* Quick Actions (1/3) */}
                <Card className="p-6">
                    <h3 className="text-sm font-bold text-slate-700 uppercase tracking-wider mb-5 flex items-center gap-2">
                        <span className="w-2 h-2 rounded-full bg-blue-500"></span>
                        Quick Actions
                    </h3>
                    <div className="space-y-3">
                        {quickActions.map((action) => (
                            <button
                                key={action.label}
                                onClick={() => navigate(action.to)}
                                className={`w-full flex items-center gap-3 p-3.5 rounded-xl text-left transition-all duration-200 group ${action.color}`}
                            >
                                <action.icon className="w-5 h-5 flex-shrink-0" />
                                <span className="text-sm font-bold flex-1">{action.label}</span>
                                <FiArrowRight className="w-4 h-4 opacity-0 group-hover:opacity-100 transition-opacity duration-200" />
                            </button>
                        ))}
                    </div>
                </Card>
            </div>
        </div>
    );
};

export default NutritionistDashboard;
