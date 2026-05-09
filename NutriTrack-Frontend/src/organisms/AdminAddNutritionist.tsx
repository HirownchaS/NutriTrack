import React, { useState } from 'react';
import Card from '../atoms/Card';
import Input from '../atoms/Input';
import Button from '../atoms/Button';
import { createNutritionistAccount } from '../firebase/auth'; // Import direct Firebase Auth function
import { useAuth } from '../context/AuthContext';
import { FiUserPlus, FiCheckCircle, FiAlertCircle } from 'react-icons/fi';



interface NutritionistForm {
    name: string;
    email: string;
    password: string;
    specialization: string;
    experience: string;
}

const AdminAddNutritionist: React.FC = () => {
    const { user } = useAuth();
    const [form, setForm] = useState<NutritionistForm>({
        name: '',
        email: '',
        password: '',
        specialization: '',
        experience: '',
    });
    const [isLoading, setIsLoading] = useState(false);
    const [success, setSuccess] = useState('');
    const [error, setError] = useState('');

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const { id, value } = e.target;
        setForm(prev => ({ ...prev, [id]: value }));
    };

    const handleSelectChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
        const { name, value } = e.target;
        setForm(prev => ({ ...prev, [name]: value }));
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');
        setSuccess('');

        // Validation
        if (!form.name || !form.email || !form.password || !form.specialization || !form.experience) {
            setError('All fields are required.');
            return;
        }
        if (form.password.length < 6) {
            setError('Password must be at least 6 characters.');
            return;
        }

        setIsLoading(true);

        try {
            // Use direct Firebase creation (secondary auth instance)
            await createNutritionistAccount(form, user?.uid || '');
            
            setSuccess(`Nutritionist "${form.name}" created successfully!`);
            setForm({ name: '', email: '', password: '', specialization: '', experience: '' });

            // Auto-clear success message after 5 seconds
            setTimeout(() => setSuccess(''), 5000);
        } catch (err) {
            console.error('Create nutritionist error:', err);
            let errorMsg = 'Failed to create nutritionist account.';
            if (err instanceof Error) {
                if (err.message.includes('email-already-in-use')) {
                    errorMsg = 'This email is already in use by another account.';
                } else {
                    errorMsg = err.message;
                }
            }
            setError(errorMsg);
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="space-y-6 animate-fade-in">
            {/* Header */}
            <div>
                <h2 className="text-2xl font-black text-slate-800 tracking-tight flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center shadow-lg">
                        <FiUserPlus className="w-5 h-5 text-white" />
                    </div>
                    Add Nutritionist
                </h2>
                <p className="text-slate-500 text-sm font-medium mt-2 ml-[52px]">
                    Create a secure nutritionist account using Firebase Authentication.
                </p>
            </div>

            {/* Form Card */}
            <Card className="max-w-2xl p-8">
                {/* Success Alert */}
                {success && (
                    <div className="mb-6 p-4 bg-emerald-50 text-emerald-700 rounded-xl text-sm border border-emerald-200 font-medium flex items-center gap-3">
                        <FiCheckCircle className="w-5 h-5 flex-shrink-0" />
                        {success}
                    </div>
                )}

                {/* Error Alert */}
                {error && (
                    <div className="mb-6 p-4 bg-red-50 text-red-600 rounded-xl text-sm border border-red-200 font-medium flex items-center gap-3">
                        <FiAlertCircle className="w-5 h-5 flex-shrink-0" />
                        {error}
                    </div>
                )}

                <form onSubmit={handleSubmit} className="space-y-5">
                    {/* Row 1: Name, Email */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <Input
                            id="name"
                            label="Full Name"
                            placeholder="Dr. John Smith"
                            value={form.name}
                            onChange={handleChange}
                            required
                        />
                        <Input
                            id="email"
                            label="Email Address"
                            type="email"
                            placeholder="nutritionist@example.com"
                            value={form.email}
                            onChange={handleChange}
                            required
                        />
                    </div>

                    {/* Row 2: Password */}
                    <Input
                        id="password"
                        label="Account Password"
                        type="password"
                        placeholder="Min 6 characters"
                        value={form.password}
                        onChange={handleChange}
                        required
                    />

                    {/* Row 3: Specialization, Experience */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div className="flex flex-col mb-4">
                            <label htmlFor="specialization" className="mb-2 text-sm font-semibold text-slate-700">
                                Specialization <span className="text-red-500">*</span>
                            </label>
                            <select
                                id="specialization"
                                name="specialization"
                                value={form.specialization}
                                onChange={handleSelectChange}
                                className="px-4 py-2 border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent transition-all duration-200 bg-white"
                                required
                            >
                                <option value="">Select Specialization</option>
                                <option value="lose weight">Lose Weight</option>
                                <option value="maintain weight">Maintain Weight</option>
                                <option value="build muscle">Build Muscle</option>
                                <option value="general health">General Health</option>
                            </select>
                        </div>

                        <Input
                            id="experience"
                            label="Experience"
                            placeholder="e.g. 5 years"
                            value={form.experience}
                            onChange={handleChange}
                            required
                        />
                    </div>

                    {/* Submit Button */}
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
                                Creating Account...
                            </span>
                        ) : (
                            <span className="flex items-center justify-center gap-2">
                                <FiUserPlus className="w-5 h-5" />
                                Create Nutritionist Account
                            </span>
                        )}
                    </Button>
                </form>
            </Card>

            
        </div>
    );
};

export default AdminAddNutritionist;
