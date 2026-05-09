import React, { useState, useRef, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { FiLogOut, FiUser, FiBell } from 'react-icons/fi';
import { subscribeToNotifications, markNotificationsAsRead, Notification } from '../services/firestore';

const Navbar: React.FC = () => {
    const { user, logout } = useAuth();
    const navigate = useNavigate();
    const [drop, setDrop] = useState(false);
    const [notif, setNotif] = useState(false);
    const [items, setItems] = useState<Notification[]>([]);
    const dRef = useRef<HTMLDivElement>(null);
    const nRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (!user) return;
        return subscribeToNotifications(user.uid, setItems);
    }, [user]);

    useEffect(() => {
        const h = (e: MouseEvent) => {
            if (dRef.current && !dRef.current.contains(e.target as Node)) setDrop(false);
            if (nRef.current && !nRef.current.contains(e.target as Node)) setNotif(false);
        };
        document.addEventListener('mousedown', h);
        return () => document.removeEventListener('mousedown', h);
    }, []);

    const unread = items.filter(n => !n.isRead).length;

    return (
        <nav className="bg-white/80 backdrop-blur-md sticky top-0 z-30 shadow-sm border-b border-emerald-100">
            <div className="px-4 sm:px-6 lg:px-8">
                <div className="flex justify-between h-16 items-center">
                    <Link to="/dashboard" className="flex items-center gap-2 group">
                        <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center shadow-md group-hover:shadow-emerald-500/30 transition-all"><span className="text-white font-black text-xl">N</span></div>
                        <span className="text-xl font-black bg-clip-text text-transparent bg-gradient-to-r from-emerald-700 to-teal-700 hidden sm:block">NutriTrack</span>
                    </Link>

                    <div className="flex items-center gap-4">
                        {user && (
                            <>
                                <div className="relative" ref={nRef}>
                                    <button onClick={() => { if (!notif && unread > 0) markNotificationsAsRead(items); setNotif(!notif); setDrop(false); }} className="p-2 rounded-xl text-slate-500 hover:bg-slate-50 relative transition-all">
                                        <FiBell className="w-6 h-6" />
                                        {unread > 0 && <span className="absolute top-1.5 right-1.5 w-4 h-4 bg-rose-500 text-white text-[10px] font-black rounded-full flex items-center justify-center border-2 border-white">{unread}</span>}
                                    </button>
                                    {notif && (
                                        <div className="absolute right-0 mt-3 w-80 bg-white rounded-2xl shadow-xl border border-emerald-50 overflow-hidden z-50 animate-in fade-in slide-in-from-top-2 duration-200">
                                            <div className="px-5 py-4 border-b border-slate-50 flex items-center justify-between"><h3 className="font-black text-slate-800 text-sm">Notifications</h3>{unread > 0 && <span className="text-[10px] font-black bg-emerald-100 text-emerald-600 px-2 py-0.5 rounded-full">{unread} New</span>}</div>
                                            <div className="max-h-96 overflow-y-auto">
                                                {items.length === 0 ? <div className="py-12 text-center text-slate-400 text-xs font-bold italic">No notifications yet</div> : (
                                                    <div className="divide-y divide-slate-50">{items.map(n => (
                                                        <div key={n.id} className={`px-5 py-4 hover:bg-slate-50 transition-colors ${!n.isRead ? 'bg-emerald-50/30' : ''}`}>
                                                            <div className="flex gap-3"><div className={`w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-black flex-shrink-0 ${n.type === 'request' ? 'bg-orange-400' : 'bg-emerald-400'}`}>{n.senderName[0]}</div><div><p className="text-sm text-slate-700 font-bold leading-tight">{n.message}</p><p className="text-[10px] text-slate-400 mt-1">{n.createdAt?.toDate?.().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) || 'Just now'}</p></div></div>
                                                        </div>
                                                    ))}</div>
                                                )}
                                            </div>
                                        </div>
                                    )}
                                </div>

                                <div className="relative" ref={dRef}>
                                    <button onClick={() => { setDrop(!drop); setNotif(false); }} className="flex items-center gap-3 p-1 rounded-full hover:bg-slate-50 transition-colors">
                                        <div className="hidden sm:flex flex-col items-end mr-1"><span className="text-sm font-semibold text-slate-700">{user.name}</span><span className="text-xs font-medium text-emerald-600 capitalize">{user.role}</span></div>
                                        <div className="w-10 h-10 rounded-full bg-gradient-to-br from-emerald-400 to-teal-500 flex items-center justify-center text-white font-bold text-lg border-2 border-white ring-1 ring-emerald-100">{user.name[0]}</div>
                                    </button>
                                    {drop && (
                                        <div className="absolute right-0 mt-3 w-48 bg-white rounded-2xl shadow-xl border border-emerald-50 py-2 z-50 animate-in fade-in slide-in-from-top-2 duration-200">
                                            <Link to={user.role === 'admin' ? '/admin/profile' : user.role === 'nutritionist' ? '/nutritionist-dashboard/profile' : '/dashboard/profile'} onClick={() => setDrop(false)} className="flex items-center gap-3 px-4 py-2.5 text-sm text-slate-600 hover:bg-emerald-50 transition-colors"><FiUser className="w-4 h-4" /><span>Profile</span></Link>
                                            <button onClick={() => { setDrop(false); logout(); navigate('/login'); }} className="flex items-center gap-3 px-4 py-2.5 text-sm text-slate-600 hover:bg-red-50 hover:text-red-600 transition-colors w-full text-left"><FiLogOut className="w-4 h-4" /><span>Sign Out</span></button>
                                        </div>
                                    )}
                                </div>
                            </>
                        )}
                    </div>
                </div>
            </div>
        </nav>
    );
};

export default Navbar;
