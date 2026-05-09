import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import Input from '../atoms/Input';
import Button from '../atoms/Button';
import Card from '../atoms/Card';
import { sendPasswordReset } from '../firebase/auth';


const ForgotPasswordForm: React.FC = () => {
    const [email, setEmail] = useState<string>('');
    const [error, setError] = useState<string>('');
    const [success, setSuccess] = useState<boolean>(false);
    const [isLoading, setIsLoading] = useState<boolean>(false);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');
        setSuccess(false);

        // Basic email format validation
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(email)) {
            setError('Please enter a valid email address.');
            return;
        }

        setIsLoading(true);

        try {
            await sendPasswordReset(email);
            setSuccess(true);
        } catch (err: unknown) {
            if (err instanceof Error) {
                setError(err.message);
            } else {
                setError('Something went wrong. Please try again.');
            }
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <Card className="w-full max-w-md p-8 bg-white/80 backdrop-blur-lg border border-white/20 shadow-xl rounded-2xl">
            <div className="text-center mb-8">
                <h2 className="text-3xl font-extrabold text-slate-800">Reset Password</h2>
                <p className="text-slate-500 mt-2">
                    Enter your email and we'll send you a reset link
                </p>
            </div>

            {/* Error message */}
            {error && (
                <div
                    className="mb-4 p-3 bg-red-50 text-red-600 rounded-xl text-sm border border-red-200 font-medium"
                    role="alert"
                >
                    {error}
                </div>
            )}

            {/* Success message */}
            {success ? (
                <div
                    className="mb-6 p-4 bg-emerald-50 text-emerald-700 rounded-xl text-sm border border-emerald-200 font-medium text-center"
                    role="status"
                >
                    ✅ Password reset link sent to your email. Please check your inbox.
                </div>
            ) : (
                <form onSubmit={handleSubmit} className="space-y-6">
                    <Input
                        id="forgot-password-email"
                        label="Email Address"
                        type="email"
                        placeholder="user@example.com"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
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
                                Sending...
                            </span>
                        ) : (
                            'Send Reset Link'
                        )}
                    </Button>
                </form>
            )}

            {/* Back to login link */}
            <div className="mt-6 text-center text-sm text-slate-500">
                Remembered your password?{' '}
                <Link to="/login" className="text-emerald-600 font-semibold hover:text-emerald-700 transition-colors">
                    Back to Login
                </Link>
            </div>
        </Card>
    );
};

export default ForgotPasswordForm;
