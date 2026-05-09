import React from 'react';
import ResetPasswordForm from '../molecules/ResetPasswordForm';


const ResetPassword: React.FC = () => {
    return (
        <div className="min-h-screen bg-gradient-to-br from-emerald-50 to-teal-50 flex flex-col justify-center items-center py-12 px-4 sm:px-6 lg:px-8">

            {/* Brand Header */}
            <div className="mb-8 text-center flex flex-col items-center">
                <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center shadow-lg shadow-emerald-500/30 mb-4">
                    <span className="text-white font-black text-3xl">N</span>
                </div>
                <h1 className="text-4xl font-black text-slate-800 tracking-tight">
                    NutriTrack
                </h1>
                <p className="mt-2 text-lg text-slate-500 font-medium">
                    Secure Account Recovery
                </p>
            </div>

            <ResetPasswordForm />

            {/* Footer */}
            <div className="mt-12 text-center text-sm text-slate-500">
                <p>&copy; {new Date().getFullYear()} NutriTrack Inc. All rights reserved.</p>
            </div>
        </div>
    );
};

export default ResetPassword;
