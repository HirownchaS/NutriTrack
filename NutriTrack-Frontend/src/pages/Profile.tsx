import React, { useState, useEffect } from 'react';
import Card from '../atoms/Card';
import Input from '../atoms/Input';
import Button from '../atoms/Button';
import { auth } from '../firebase/config';
import { getUserProfile, updateUserDoc } from '../firebase/auth';


interface ProfileForm {
    name: string;
    age: string;
    weight: string;
    height: string;
    gender: string;
    dietaryPreference: string;
    allergies: string;
    activityLevel: string;
    fitnessGoal: string;
    healthCondition: string;
    
}

const Profile: React.FC = () => {
    const [form, setForm] = useState<ProfileForm>({
        name: '',
        age: '',
        weight: '',
        height: '',
        gender: 'male',
        dietaryPreference: 'none',
        allergies: '',
        activityLevel: 'moderate',
        fitnessGoal: 'lose weight',
        healthCondition: 'none',
    
    });
    const [saved, setSaved] = useState<boolean>(false);
    const [loading, setLoading] = useState<boolean>(true);
    const [updating, setUpdating] = useState<boolean>(false);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        const fetchProfile = async () => {
            try {
                const user = auth.currentUser;
                if (!user) {
                    setError("User not authenticated");
                    setLoading(false);
                    return;
                }

                const profileData = await getUserProfile(user.uid);
                if (profileData) {
                    setForm({
                        name: profileData.name || '',
                        age: profileData.age?.toString() || '',
                        weight: profileData.weight?.toString() || '',
                        height: profileData.height?.toString() || '',
                        gender: profileData.gender || 'male',
                        dietaryPreference: profileData.dietaryPreference || 'none',
                        allergies: profileData.allergies || '',
                        activityLevel: profileData.activityLevel || 'moderate',
                        fitnessGoal: profileData.fitnessGoal,
                        healthCondition: profileData.healthCondition || 'none'
                    });
                }
            } catch (err) {
                console.error("Error fetching profile:", err);
                setError("Failed to load profile data.");
            } finally {
                setLoading(false);
            }
        };

        fetchProfile();
    }, []);

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const { id, value } = e.target;
        setForm(prev => ({ ...prev, [id]: value }));
        setSaved(false);
    };

    const handleSelectChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
        const { name, value } = e.target;
        setForm(prev => ({ ...prev, [name]: value }));
        setSaved(false);
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setUpdating(true);
        setError(null);

        try {
            const user = auth.currentUser;
            if (!user) throw new Error("User not authenticated");

            const updateData: Record<string, any> = {
                ...form,
                updatedAt: new Date(),
            };
            
            await updateUserDoc(user.uid, updateData);

            setSaved(true);
            setTimeout(() => setSaved(false), 3000);
        } catch (err) {
            console.error("Error updating profile:", err);
            setError("Failed to update profile.");
        } finally {
            setUpdating(false);
        }
    };

    return (
        <div className="max-w-4xl mx-auto space-y-6">
            <div>
                <h1 className="text-2xl font-black text-slate-800 tracking-tight">Profile & Settings</h1>
                <p className="text-sm text-slate-500 mt-1 font-medium">Manage your personal details and nutritional preferences.</p>
            </div>

            {error && (
                <div className="p-4 bg-red-50 text-red-700 rounded-2xl text-sm font-bold border border-red-200 shadow-sm" role="alert">
                    ❌ {error}
                </div>
            )}

            {saved && (
                <div className="p-4 bg-emerald-50 text-emerald-700 rounded-2xl text-sm font-bold border border-emerald-200 shadow-sm animate-fade-in" role="status">
                    ✅ Your profile has been updated successfully!
                </div>
            )}

            {loading ? (
                <div className="flex flex-col items-center justify-center py-20 space-y-4">
                    <div className="w-12 h-12 border-4 border-emerald-200 border-t-emerald-600 rounded-full animate-spin"></div>
                    <p className="text-slate-500 font-medium">Loading your profile...</p>
                </div>
            ) : (
                <Card className="p-6 md:p-8">
                    <form onSubmit={handleSubmit} className="space-y-8">
                        {/* Basic Information */}
                        <fieldset className="space-y-5">
                            <legend className="text-xs font-black text-slate-400 uppercase tracking-widest mb-2 px-1">Basic Information</legend>
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                                <Input id="name" label="Full Name" placeholder="John Doe" value={form.name} onChange={handleChange} required />
                                <Input id="age" label="Age" type="number" placeholder="25" value={form.age} onChange={handleChange} required />

                                <div className="flex flex-col">
                                    <label htmlFor="gender" className="mb-2 text-sm font-semibold text-slate-700">Gender</label>
                                    <select
                                        id="gender" name="gender" value={form.gender} onChange={handleSelectChange}
                                        className="px-4 py-2 pr-10 border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500 bg-white appearance-none -webkit-appearance-none -moz-appearance-none custom-select"
                                    >
                                        <option value="male">Male</option>
                                        <option value="female">Female</option>
                                        <option value="other">Other</option>
                                    </select>
                                </div>

                                <Input id="weight" label="Weight (kg)" type="number" placeholder="70" value={form.weight} onChange={handleChange} required />
                               
                                <Input id="height" label="Height (cm)" type="number" placeholder="175" value={form.height} onChange={handleChange} required />

                                <div className="flex flex-col">
                                    <label htmlFor="activityLevel" className="mb-2 text-sm font-semibold text-slate-700">Activity Level</label>
                                    <select
                                        id="activityLevel" name="activityLevel" value={form.activityLevel} onChange={handleSelectChange}
                                        className="px-4 py-2 pr-10 border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500 bg-white appearance-none -webkit-appearance-none -moz-appearance-none custom-select"
                                    >
                                        <option value="sedentary">Sedentary</option>
                                        <option value="light">Lightly Active</option>
                                        <option value="moderate">Moderately Active</option>
                                        <option value="active">Very Active</option>
                                        <option value="extreme">Extreme Athlete</option>
                                    </select>
                                </div>
                            </div>
                        </fieldset>

                        {/* Goals & Health */}
                        <fieldset className="space-y-5">
                            <legend className="text-xs font-black text-slate-400 uppercase tracking-widest mb-2 px-1">Goals & Health</legend>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                <div className="flex flex-col">
                                    <label htmlFor="fitnessGoal" className="mb-2 text-sm font-semibold text-slate-700">Fitness Goal</label>
                                    <select
                                        id="fitnessGoal" name="fitnessGoal" value={form.fitnessGoal} onChange={handleSelectChange}
                                        className="px-4 py-2 pr-10 border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500 bg-white appearance-none -webkit-appearance-none -moz-appearance-none custom-select"
                                    >
                                        <option value="lose weight">Lose Weight</option>
                                        <option value="maintain weight">Maintain Weight</option>
                                        <option value="build muscle">Build Muscle</option>
                                        <option value="general health">General Health</option>
                                    </select>
                                </div>

                                <div className="flex flex-col">
                                    <label htmlFor="healthCondition" className="mb-2 text-sm font-semibold text-slate-700">Health Condition</label>
                                    <select
                                        id="healthCondition" name="healthCondition" value={form.healthCondition} onChange={handleSelectChange}
                                        className="px-4 py-2 pr-10 border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500 bg-white appearance-none -webkit-appearance-none -moz-appearance-none custom-select"
                                    >
                                        <option value="none">None</option>
                                        <option value="diabetes">Diabetes</option>
                                        <option value="hypertension">Hypertension</option>
                                        <option value="cholesterol">High Cholesterol</option>
                                        <option value="thyroid">Thyroid Disorder</option>

                                    </select>
                                </div>
                            </div>
                        </fieldset>

                        {/* Dietary Details */}
                        <fieldset className="space-y-5">
                            <legend className="text-xs font-black text-slate-400 uppercase tracking-widest mb-2 px-1">Dietary Details</legend>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                <div className="flex flex-col">
                                    <label htmlFor="dietaryPreference" className="mb-2 text-sm font-semibold text-slate-700">Diet Type</label>
                                    <select
                                        id="dietaryPreference" name="dietaryPreference" value={form.dietaryPreference} onChange={handleSelectChange}
                                        className="px-4 py-2 pr-10 border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500 bg-white appearance-none -webkit-appearance-none -moz-appearance-none custom-select"
                                    >
                                        <option value="none">No Preference</option>
                                        <option value="vegetarian">Vegetarian</option>
                                        <option value="vegan">Vegan</option>
                                        {/* <option value="keto">Keto</option>
                                        <option value="paleo">Paleo</option>
                                        <option value="lowcarb">Low Carb</option> */}
                                    </select>
                                </div>

                                <Input id="allergies" label="Allergies" placeholder="e.g. nuts, dairy" value={form.allergies} onChange={handleChange} />
                            </div>
                        </fieldset>

                        <Button type="submit" variant="primary" className="w-full md:w-auto py-3 px-8" disabled={updating}>
                            {updating ? 'Saving...' : 'Save Profile'}
                        </Button>
                    </form>
                </Card>
            )}
        </div>
    );
};

export default Profile;
