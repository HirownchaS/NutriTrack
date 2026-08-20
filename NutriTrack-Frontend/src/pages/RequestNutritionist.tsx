import React, { useState, useEffect } from 'react';
import { getDoc, doc, collection, query, where, onSnapshot } from 'firebase/firestore';
import { db } from '../firebase/config';
import { getNutritionists, sendNutritionistRequest, getUserAllNutritionistRequests } from '../firebase/auth';
import { useAuth } from '../context/AuthContext';
import NutritionistCard from '../molecules/NutritionistCard';
import { FiUsers, FiSearch, FiInfo } from 'react-icons/fi';
import { Nutritionist } from '../types/nutrition';
import { useNotification } from '../context/NotificationContext';
import { goalsMatch } from '../services/goalMatching';



const RequestNutritionist: React.FC = () => {
    const { user } = useAuth();
    const [nutritionists, setNutritionists] = useState<Nutritionist[]>([]);
    const [userFitnessGoal, setUserFitnessGoal] = useState<string>('');
    const [requestStatuses, setRequestStatuses] = useState<Record<string, string>>({});
    const [isLoading, setIsLoading] = useState<boolean>(true); // Default to loading
    const [isFallback, setIsFallback] = useState<boolean>(false);
    const [searchQuery, setSearchQuery] = useState<string>('');
    const [error, setError] = useState<string>('');
    const { success, warning, error: notifyError } = useNotification();

    const fetchData = async () => {
        if (!user) return;
        setIsLoading(true);
        setError('');
        setIsFallback(false);
        
        try {
            // 1. Fetch User Data to get fitness goal
            let goalValue = '';
            try {
                const userDoc = await getDoc(doc(db, 'users', user.uid));
                if (userDoc.exists()) {
                    const userData = userDoc.data();
                    goalValue = userData.fitnessGoal || '';
                    setUserFitnessGoal(goalValue);
                }
            } catch (err) {
                console.error("Error fetching user data:", err);
            }

            // 2. Fetch Nutritionists
            try {
                const experts = await getNutritionists();
                const normalizedExperts: Nutritionist[] = experts.map((e: any) => ({
                    id: e.id,
                    name: e.name || 'Unknown Name',
                    email: e.email || 'No Email',
                    experience: e.experience || 'Expert',
                    specialization: e.specialization || 'General Nutrition',
                    rating: e.rating || 5,
                    clients_count: e.clients_count || 0,
                    image: e.image || ''
                }));

                // Flexible Filtering Logic
                const filterExperts = (list: Nutritionist[], goal: string) => {
                    if (!goal) return list;
                    return list.filter(e => goalsMatch(goal, e.specialization));
                };

                let matching = filterExperts(normalizedExperts, goalValue);

                // Fallback mechanism: if no matches, show all but set fallback flag
                if (matching.length === 0 && goalValue) {
                    matching = normalizedExperts;
                    setIsFallback(true);
                } else if (!goalValue) {
                    setError('Please complete your profile fitness goal to see personalized matches.');
                    matching = normalizedExperts;
                }
                
                setNutritionists(matching);
            } catch (err: any) {
                console.error("Error fetching nutritionists:", err);
                setError('Failed to load nutritionists. Please try again later.');
            }

            // 3. Setup User's Request Statuses Real-time Listener
            try {
                const unsubscribe = onSnapshot(
                    query(
                        collection(db, "nutritionist_requests"),
                        where("userId", "==", user.uid)
                    ),
                    (snapshot) => {
                        const statusMap: Record<string, string> = {};
                        snapshot.docs.forEach((doc) => {
                            const data = doc.data();
                            statusMap[data.nutritionistId] = data.status;
                        });
                        setRequestStatuses(statusMap);
                    },
                    (err) => {
                        console.error("Real-time listener error:", err);
                    }
                );
                
                (window as any).__reqUnsub = unsubscribe;

            } catch (err: any) {
                console.error("Error setting up request listener:", err);
            }
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        if (user) {
            fetchData();
        }
        return () => {
            if ((window as any).__reqUnsub) {
                (window as any).__reqUnsub();
            }
        };
    }, [user]);

    const handleRequest = async (nutritionistId: string | number) => {
        if (!user) return;
        const idStr = nutritionistId.toString();
        
        try {
            await sendNutritionistRequest(user.uid, idStr);
            setRequestStatuses(prev => ({ ...prev, [idStr]: 'pending' }));
            success('Request sent successfully!');
        } catch (err: any) {
            console.error("Request Error:", err);
            if (err.message === 'duplicate-request') {
                warning('You have already sent a request to this nutritionist.');
                setRequestStatuses(prev => ({ ...prev, [idStr]: 'pending' }));
            } else {
                notifyError('Failed to send request. Please try again.');
            }
        }
    };

    const filteredNutritionists = nutritionists.filter(n =>
        n.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        n.specialization.toLowerCase().includes(searchQuery.toLowerCase())
    );

    return (
        <div className="p-6 max-w-7xl mx-auto space-y-8 animate-fade-in duration-500">
            {/* Header Section */}
            <header className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h1 className="text-3xl font-black text-slate-800 flex items-center gap-3">
                        <div className="p-2 bg-emerald-100 text-emerald-600 rounded-xl">
                            <FiUsers className="w-8 h-8" />
                        </div>
                        Nutritionist Portal
                    </h1>
                    <p className="mt-2 text-slate-500 font-medium">Find and connect with certified nutrition experts.</p>
                </div>

                {/* Search Bar - Always shown if results available */}
                <div className="relative w-full md:w-80">
                    <FiSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 w-5 h-5" />
                    <input
                        type="text"
                        placeholder="Search experts..."
                        className="w-full pl-10 pr-4 py-2.5 bg-white border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all shadow-sm"
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                    />
                </div>
            </header>

            {isLoading ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-8">
                    {[1, 2, 3].map(n => (
                        <div key={n} className="bg-white rounded-2xl h-[400px] animate-pulse border border-slate-100 shadow-sm" />
                    ))}
                </div>
            ) : !userFitnessGoal ? (
                <div className="flex flex-col items-center justify-center py-20 bg-white rounded-3xl border border-dashed border-emerald-200 shadow-sm transition-all hover:shadow-md">
                    <div className="w-20 h-20 bg-amber-50 rounded-full flex items-center justify-center mb-6">
                        <FiInfo className="w-10 h-10 text-amber-600" />
                    </div>
                    <h2 className="text-2xl font-black text-slate-800 mb-2 text-center">Goal Required</h2>
                    <p className="text-slate-500 mb-8 max-w-md text-center font-medium">To provide you with the best experts, we need to know your fitness goal. Please update your profile to continue.</p>
                    <a
                        href="/dashboard/profile"
                        className="px-8 py-4 bg-emerald-600 text-white font-black rounded-2xl shadow-lg shadow-emerald-200 hover:bg-emerald-700 hover:-translate-y-1 transition-all active:scale-95 flex items-center gap-3 text-lg"
                    >
                        Go to Profile
                    </a>
                </div>
            ) : (
                <>
                    {/* Info Box */}
                    <div className={`${isFallback ? 'bg-amber-50 border-amber-100' : 'bg-emerald-50 border-emerald-100'} border p-4 rounded-2xl flex items-start gap-3 transition-colors duration-300`}>
                        <FiInfo className={`${isFallback ? 'text-amber-600' : 'text-emerald-600'} w-5 h-5 mt-0.5 flex-shrink-0`} />
                        <div className="flex flex-col">
                            <p className={`text-sm ${isFallback ? 'text-amber-700' : 'text-emerald-700'} font-bold uppercase tracking-wider text-[10px]`}>
                                {isFallback ? 'Fallback Filter: All Experts' : `Active Filter: ${userFitnessGoal}`}
                            </p>
                            <p className={`text-sm ${isFallback ? 'text-amber-700' : 'text-emerald-700'} font-medium`}>
                                {isFallback 
                                    ? `We couldn't find an exact match for "${userFitnessGoal}", showing all available experts.` 
                                    : `Showing experts specialized in ${userFitnessGoal} to match your fitness goal.`}
                            </p>
                        </div>
                    </div>

                    {error && (
                        <div className="p-4 bg-red-50 text-red-600 rounded-2xl border border-red-100 font-medium">
                            {error}
                        </div>
                    )}

                    {filteredNutritionists.length > 0 ? (
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-8">
                            {filteredNutritionists.map(nutritionist => (
                                <NutritionistCard
                                    key={nutritionist.id}
                                    nutritionist={nutritionist}
                                    status={(requestStatuses[nutritionist.id] || 'none') as any}
                                    onSendRequest={handleRequest}
                                />
                            ))}
                        </div>
                    ) : (
                        <div className="text-center py-20 bg-white rounded-3xl border border-dashed border-slate-200">
                            <div className="p-4 bg-slate-50 text-slate-400 rounded-full w-fit mx-auto mb-4">
                                <FiUsers className="w-12 h-12" />
                            </div>
                            <h2 className="text-xl font-bold text-slate-700">No matching experts found</h2>
                            <p className="text-slate-500 mt-1">We couldn't find any nutritionists specialized in <strong>{userFitnessGoal}</strong> right now.</p>
                            <button onClick={fetchData} className="mt-4 text-emerald-600 font-bold hover:underline">Refresh List</button>
                        </div>
                    )}
                </>
            )}
        </div>
    );
};

export default RequestNutritionist;
