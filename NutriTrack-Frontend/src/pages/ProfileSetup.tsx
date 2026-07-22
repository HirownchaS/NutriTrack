import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Card from '../atoms/Card';
import Input from '../atoms/Input';
import Button from '../atoms/Button';
import { saveProfile } from '../firebase/auth';
import { useAuth } from '../context/AuthContext';



interface ProfileSetupForm {
    age: string;
    weight: string;
    height: string;
    gender: string;
    healthCondition: string;
    fitnessGoal: string;
    activityLevel: string;
}

const ProfileSetup: React.FC = () => {
    const [form, setForm] = useState<ProfileSetupForm>({
        age: '',
        weight: '',
        height: '',
        gender: 'male',
        healthCondition: 'none',
        fitnessGoal: 'maintain',
        activityLevel: 'moderate',
    });
    const [error, setError] = useState<string>('');
    const [isLoading, setIsLoading] = useState<boolean>(false);
    const navigate = useNavigate();
    const { completeProfile, user, logout } = useAuth();

    // Handle text/number input changes
    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const { id, value } = e.target;
        setForm(prev => ({ ...prev, [id]: value }));
    };

    // Handle select dropdown changes
    const handleSelectChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
        const { name, value } = e.target;
        setForm(prev => ({ ...prev, [name]: value }));
    };

    // Handle profile submission
    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');

        // Basic validation
        if (!form.age || !form.weight || !form.height) {
            setError('Please fill in all required fields.');
            return;
        }

        setIsLoading(true);

        try {
            // Auto-calculate Calorie Goal (Mifflin-St Jeor Equation)
            const weight = parseFloat(form.weight);
            const height = parseFloat(form.height);
            const age = parseInt(form.age);

            let bmr = (10 * weight) + (6.25 * height) - (5 * age);
            bmr = form.gender === 'male' ? bmr + 5 : bmr - 161;

            const multipliers: Record<string, number> = {
                sedentary: 1.2,
                light: 1.375,
                moderate: 1.55,
                active: 1.725,
                extreme: 1.9
            };

            let tdee = bmr * (multipliers[form.activityLevel] || 1.2);

            // Adjust based on goal
            let dailyCalorieGoal = tdee;
            if (form.fitnessGoal === 'lose weight') dailyCalorieGoal -= 500;
            else if (form.fitnessGoal === 'build muscle') dailyCalorieGoal += 500;

            const finalGoal = Math.round(dailyCalorieGoal);

            if (user) {
                const profileData: Record<string, any> = {
                    ...form,
                    dailyCalorieGoal: finalGoal,
                    createdAt: new Date()
                };
                await saveProfile(user.uid, profileData);
            }

            // Mark profile as complete in context + localStorage
            completeProfile();

            // Log out the user so they can log back in at the Login page
            await logout();

            // Redirect to login page
            navigate('/login');
        } catch (err) {
            const errorMsg = err instanceof Error ? err.message : 'Failed to save profile. Please try again.';
            setError(errorMsg);
        } finally {
            setIsLoading(false);
        }
    };

    // Step indicator for the onboarding flow
    const steps = [
        { label: 'Register', done: true },
        { label: 'Profile', done: false, active: true },
        { label: 'Login', done: false },
        { label: 'Dashboard', done: false },
    ];

    return (
        <div className="min-h-screen bg-gradient-to-br from-emerald-50 to-teal-50 flex flex-col justify-center items-center py-12 px-4 sm:px-6 lg:px-8">

            {/* Brand Header */}
            <div className="mb-6 text-center flex flex-col items-center">
                <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center shadow-lg shadow-emerald-500/30 mb-4">
                    <span className="text-white font-black text-2xl">N</span>
                </div>
                <h1 className="text-3xl font-black text-slate-800 tracking-tight">Complete Your Profile</h1>
                <p className="mt-2 text-sm text-slate-500 font-medium">Tell us about yourself so we can personalize your experience.</p>
            </div>

            {/* Step Progress Indicator */}
            <div className="flex items-center gap-2 mb-8" role="navigation" aria-label="Onboarding steps">
                {steps.map((step, i) => (
                    <React.Fragment key={step.label}>
                        <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold transition-all ${step.done
                            ? 'bg-emerald-100 text-emerald-700'
                            : step.active
                                ? 'bg-emerald-600 text-white shadow-md'
                                : 'bg-slate-100 text-slate-400'
                            }`}>
                            <span>{step.done ? '✓' : i + 1}</span>
                            <span className="hidden sm:inline">{step.label}</span>
                        </div>
                        {i < steps.length - 1 && (
                            <div className={`w-6 h-0.5 ${step.done ? 'bg-emerald-400' : 'bg-slate-200'}`} />
                        )}
                    </React.Fragment>
                ))}
            </div>

            {/* Profile Form Card */}
            <Card className="w-full max-w-lg p-8 bg-white/80 backdrop-blur-lg shadow-xl rounded-2xl">

                {/* Error Alert */}
                {error && (
                    <div className="mb-4 p-3 bg-red-50 text-red-600 rounded-xl text-sm border border-red-200 font-medium" role="alert">
                        {error}
                    </div>
                )}

                <form onSubmit={handleSubmit} className="space-y-5">

                    {/* Row 1: Age, Gender */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <Input
                            id="age"
                            label="Age"
                            type="number"
                            placeholder="25"
                            value={form.age}
                            onChange={handleChange}
                            required
                        />
                        <div className="flex flex-col mb-4">
                            <label htmlFor="gender" className="mb-2 text-sm font-semibold text-slate-700">
                                Gender <span className="text-red-500">*</span>
                            </label>
                            <select
                                id="gender"
                                name="gender"
                                value={form.gender}
                                onChange={handleSelectChange}
                                className="px-4 py-2 pr-10 border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent transition-all duration-200 bg-white appearance-none -webkit-appearance-none -moz-appearance-none custom-select"
                                aria-label="Select your gender"
                            >
                                <option value="male">Male</option>
                                <option value="female">Female</option>

                            </select>
                        </div>
                    </div>

                    {/* Row 2: Weight, Height */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <Input
                            id="weight"
                            label="Weight (kg)"
                            type="number"
                            placeholder="70"
                            value={form.weight}
                            onChange={handleChange}
                            required
                        />
                        <Input
                            id="height"
                            label="Height (cm)"
                            type="number"
                            placeholder="175"
                            value={form.height}
                            onChange={handleChange}
                            required
                        />
                    </div>

                    {/* Health Condition */}
                    <div className="flex flex-col mb-4">
                        <label htmlFor="healthCondition" className="mb-2 text-sm font-semibold text-slate-700">
                            Health Condition
                        </label>
                        <select
                            id="healthCondition"
                            name="healthCondition"
                            value={form.healthCondition}
                            onChange={handleSelectChange}
                            className="px-4 py-2 pr-10 border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent transition-all duration-200 bg-white appearance-none -webkit-appearance-none -moz-appearance-none custom-select"
                            aria-label="Select your health condition"
                        >
                            <option value="none">None</option>
                            <option value="diabetes">Diabetes</option>
                            <option value="hypertension">Hypertension</option>
                            <option value="cholesterol">High Cholesterol</option>
                            <option value="thyroid">Thyroid Disorder</option>

                        </select>
                    </div>

                    {/* Row 3: Fitness Goal, Activity Level */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div className="flex flex-col mb-4">
                            <label htmlFor="fitnessGoal" className="mb-2 text-sm font-semibold text-slate-700">
                                Fitness Goal
                            </label>
                            <select
                                id="fitnessGoal"
                                name="fitnessGoal"
                                value={form.fitnessGoal}
                                onChange={handleSelectChange}
                                className="px-4 py-2 pr-10 border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent transition-all duration-200 bg-white appearance-none -webkit-appearance-none -moz-appearance-none custom-select"
                                aria-label="Select your fitness goal"
                            >
                                <option value="lose weight">Lose Weight</option>
                                <option value="maintain weight">Maintain Weight</option>
                                <option value="build muscle">Build Muscle</option>
                                <option value="general health">General Health</option>
                            </select>
                        </div>

                        <div className="flex flex-col mb-4">
                            <label htmlFor="activityLevel" className="mb-2 text-sm font-semibold text-slate-700">
                                Activity Level
                            </label>
                            <select
                                id="activityLevel"
                                name="activityLevel"
                                value={form.activityLevel}
                                onChange={handleSelectChange}
                                className="px-4 py-2 pr-10 border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent transition-all duration-200 bg-white appearance-none -webkit-appearance-none -moz-appearance-none custom-select"
                                aria-label="Select your activity level"
                            >
                                <option value="sedentary">Sedentary</option>
                                <option value="light">Lightly Active</option>
                                <option value="moderate">Moderately Active</option>
                                <option value="active">Very Active</option>
                                <option value="extreme">Extreme Athlete</option>
                            </select>
                        </div>
                    </div>

                    <Button
                        type="submit"
                        variant="primary"
                        className="w-full py-3 text-lg font-bold"
                        disabled={isLoading}
                    >
                        {isLoading ? (
                            <span className="flex items-center justify-center gap-2">
                                <svg className="w-5 h-5 animate-spin" fill="none" viewBox="0 0 24 24" aria-hidden="true">
                                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                                </svg>
                                Saving Profile...
                            </span>
                        ) : (
                            'Save & Continue to Login'
                        )}
                    </Button>
                </form>
            </Card>

            {/* Footer */}
            <div className="mt-12 text-center text-sm text-slate-500">
                <p>&copy; {new Date().getFullYear()} NutriTrack Inc. All rights reserved.</p>
            </div>
        </div>
    );
};

export default ProfileSetup;
