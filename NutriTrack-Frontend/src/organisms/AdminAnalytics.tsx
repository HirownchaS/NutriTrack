import React, { useState, useEffect } from 'react';
import Card from '../atoms/Card';
import { getAdminStats } from '../services/api';
import { FiUsers, FiActivity, FiClipboard, FiCheckCircle, FiClock, FiTrendingUp } from 'react-icons/fi';


interface AdminStats {
    totalUsers: number;
    totalNutritionists: number;
    totalFoodLogs: number;
    activeDietPlans: number;
    pendingNutritionistRequests: number;
    systemWideAvgCalories: number;
}

const AdminAnalytics: React.FC = () => {
    const [stats, setStats] = useState<AdminStats | null>(null);
    const [loading, setLoading] = useState<boolean>(true);

    useEffect(() => {
        const fetchStats = async () => {
            try {
                const res = await getAdminStats();
                setStats(res.data);
            } catch (err) {
                console.error("Failed to fetch admin stats", err);
            } finally {
                setLoading(false);
            }
        };
        fetchStats();
    }, []);

    if (loading) {
        return (
            <div className="flex justify-center items-center h-64">
                <div className="w-10 h-10 border-4 border-emerald-200 border-t-emerald-600 rounded-full animate-spin"></div>
            </div>
        );
    }

    const statCards = [
        { label: 'Total Users', value: stats?.totalUsers, icon: FiUsers, color: 'from-blue-500 to-indigo-600' },
        { label: 'Nutritionists', value: stats?.totalNutritionists, icon: FiActivity, color: 'from-emerald-500 to-teal-600' },
        { label: 'Total Scans', value: stats?.totalFoodLogs, icon: FiClipboard, color: 'from-orange-500 to-amber-600' },
        { label: 'Diet Plans', value: stats?.activeDietPlans, icon: FiCheckCircle, color: 'from-purple-500 to-pink-600' },
        { label: 'Pending Requests', value: stats?.pendingNutritionistRequests, icon: FiClock, color: 'from-red-500 to-rose-600' },
        { label: 'Avg Calories', value: `${stats?.systemWideAvgCalories} kcal`, icon: FiTrendingUp, color: 'from-cyan-500 to-blue-600' },
    ];

    return (
        <div className="space-y-8 animate-fade-in">
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

        </div>
    );
};

export default AdminAnalytics;
