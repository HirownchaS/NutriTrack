import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import Card from '../atoms/Card';
import Input from '../atoms/Input';
import Button from '../atoms/Button';
import { registerUser } from '../firebase/auth';
import { useAuth } from '../context/AuthContext';
import { FiEye } from 'react-icons/fi';


const Register: React.FC = () => {
    const [form, setForm] = useState({ name: '', email: '', password: '', confirmPassword: '' });
    const [error, setError] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const navigate = useNavigate();
    const { login } = useAuth();

    // Handle input changes
    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const { id, value } = e.target;
        setForm(prev => ({ ...prev, [id]: value }));
    };

    // Handle registration form submission
    const handleRegister = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');

        // Basic validation
        if (form.password !== form.confirmPassword) {
            setError('Passwords do not match.');
            return;
        }
        if (form.password.length < 6) {
            setError('Password must be at least 6 characters.');
            return;
        }

        setIsLoading(true);

        try {
            // Create Firebase Auth account + Firestore user doc
            const result = await registerUser({
                name: form.name,
                email: form.email,
                password: form.password,
            });

            // Set user in context immediately (profileComplete = false)
            login({
                uid: result.uid,
                role: 'user',
                email: result.email,
                name: form.name,
                profileComplete: false,
            });

            // Redirect to profile setup page
            navigate('/profile-setup');
        } catch (err: unknown) {
            let errorMsg = 'Registration failed. Please try again.';
            if (err instanceof Error) {
                // Parse Firebase error messages for user-friendly display
                if (err.message.includes('email-already-in-use')) {
                    errorMsg = 'This email is already registered. Try signing in.';
                } else if (err.message.includes('weak-password')) {
                    errorMsg = 'Password is too weak. Use at least 6 characters.';
                } else if (err.message.includes('invalid-email')) {
                    errorMsg = 'Please enter a valid email address.';
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
        <div className="min-h-screen bg-gradient-to-br from-emerald-50 to-teal-50 flex flex-col justify-center items-center py-12 px-4 sm:px-6 lg:px-8">

            {/* Brand Header */}
            <div className="mb-8 text-center flex flex-col items-center">
                <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center shadow-lg shadow-emerald-500/30 mb-4">
                    <span className="text-white font-black text-3xl">N</span>
                </div>
                <h1 className="text-4xl font-black text-slate-800 tracking-tight">Create Account</h1>
                <p className="mt-2 text-lg text-slate-500 font-medium">Start your nutrition journey today</p>
            </div>

            {/* Registration Card */}
            <Card className="w-full max-w-md p-8 bg-white/80 backdrop-blur-lg shadow-xl rounded-2xl">

                {/* Error Alert */}
                {error && (
                    <div className="mb-4 p-3 bg-red-50 text-red-600 rounded-xl text-sm border border-red-200 font-medium" role="alert">
                        {error}
                    </div>
                )}

                <form onSubmit={handleRegister} className="space-y-5">
                    <Input
                        id="name"
                        label="Full Name"
                        placeholder="John Doe"
                        value={form.name}
                        onChange={handleChange}
                        required
                    />
                    <Input
                        id="email"
                        label="Email Address"
                        type="email"
                        placeholder="you@example.com"
                        value={form.email}
                        onChange={handleChange}
                        required
                    />
                    <Input
                        id="password"
                        label="Password"
                        type="password"
                        placeholder="Min 6 characters"
                        value={form.password}
                        onChange={handleChange}
                        required
                    />
                    <Input
                        id="confirmPassword"
                        label="Confirm Password"
                        type="password"
                        placeholder="Re-enter password"
                        value={form.confirmPassword}
                        onChange={handleChange}
                        required
                    />

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
                            'Create Account'
                        )}
                    </Button>
                </form>

                {/* Link to Login */}
                <div className="mt-6 text-center text-sm text-slate-500">
                    Already have an account?{' '}
                    <Link to="/login" className="text-emerald-600 font-semibold hover:text-emerald-700 transition-colors">
                        Sign In
                    </Link>
                </div>
            </Card>

            {/* Footer */}
            <div className="mt-12 text-center text-sm text-slate-500">
                <p>&copy; {new Date().getFullYear()} NutriTrack Inc. All rights reserved.</p>
            </div>
        </div>
    );
};

export default Register;
