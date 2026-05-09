import React from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { FiHome, FiUpload, FiHeart, FiActivity, FiUser, FiUserPlus, FiBarChart2, FiUsers, FiFilePlus, FiCheckSquare, FiLogOut, FiMessageSquare, FiShield } from 'react-icons/fi';

const Sidebar: React.FC = () => {
    const { user, logout } = useAuth();
    const navigate = useNavigate();
    const role = user?.role || 'user';

    const menus: any = {
        user: [
            { label: 'Home', to: '/dashboard/home', icon: FiHome },
            { label: 'Food Upload', to: '/dashboard/upload', icon: FiUpload },
            { label: 'Diet Recommendation', to: '/dashboard/recommendation', icon: FiHeart },
            { label: 'Tracking', to: '/dashboard/tracking', icon: FiActivity },
            { label: 'Request Nutritionist', to: '/dashboard/request', icon: FiUserPlus },
            { label: 'Support Chat', to: '/dashboard/chat', icon: FiMessageSquare },
            { label: 'Profile', to: '/dashboard/profile', icon: FiUser },
        ],
        admin: [
            { label: 'Analytics', to: '/admin/analytics', icon: FiBarChart2 },
            { label: 'All Users', to: '/admin/users', icon: FiUsers },
            { label: 'Manage Nutritionists', to: '/admin/nutritionists', icon: FiUsers },
            { label: 'Add Nutritionist', to: '/admin/add-nutritionist', icon: FiUserPlus },
            { label: 'Tracking Reports', to: '/admin/tracking-reports', icon: FiShield },
        ],
        nutritionist: [
            { label: 'Dashboard', to: '/nutritionist-dashboard/home', icon: FiHome },
            { label: 'Assigned Users', to: '/nutritionist-dashboard/users', icon: FiUsers },
            { label: 'User Chat', to: '/nutritionist-dashboard/chat', icon: FiMessageSquare },
            { label: 'Diet Plans', to: '/nutritionist-dashboard/diet-plans', icon: FiFilePlus },
            { label: 'User Progress', to: '/nutritionist-dashboard/progress', icon: FiActivity },
        ]
    };

    const items = menus[role] || menus.user;

    return (
        <aside className="w-64 bg-emerald-800 text-white flex flex-col h-screen sticky top-0 shadow-xl z-30">
            <div className="p-6 border-b border-emerald-700/50 flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-linear-to-br from-emerald-400 to-teal-500 flex items-center justify-center shadow-lg"><span className="font-black text-white text-xl">N</span></div>
                <div><span className="font-black text-xl tracking-tight block">NutriTrack</span><span className="text-[10px] uppercase font-bold text-emerald-300 tracking-[0.2em]">{role} portal</span></div>
            </div>
            <nav className="flex-1 overflow-y-auto p-4 space-y-2">
                {items.map((i: any) => (
                    <NavLink key={i.to} to={i.to} className={({ isActive }) => `flex items-center gap-4 px-4 py-3.5 rounded-xl text-sm font-semibold transition-all group ${isActive ? 'bg-white/20 text-white shadow-inner backdrop-blur-md' : 'text-emerald-100 hover:bg-white/10 hover:text-white'}`}>
                        <i.icon className="w-5 h-5 group-hover:scale-110 transition-transform" /><span>{i.label}</span>
                    </NavLink>
                ))}
            </nav>
            <div className="p-4 border-t border-emerald-700/50 bg-emerald-900/20">
                <button onClick={() => { logout(); navigate('/login'); }} className="flex items-center gap-4 w-full px-4 py-3.5 rounded-xl text-sm font-semibold text-emerald-100 hover:bg-red-500/20 hover:text-white transition-all group">
                    <FiLogOut className="w-5 h-5 group-hover:scale-110 transition-transform" /><span>Sign Out</span>
                </button>
            </div>
        </aside>
    );
};

export default Sidebar;
