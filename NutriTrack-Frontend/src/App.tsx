import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import Login from './pages/Login';
import ForgotPassword from './pages/ForgotPassword';
import ResetPassword from './pages/ResetPassword';
import Register from './pages/Register';
import ProfileSetup from './pages/ProfileSetup';
import Dashboard from './pages/Dashboard';
import AdminPanel from './pages/AdminPanel';
import NutritionistPanel from './pages/NutritionistPanel';

const getDefaultPath = (role: string) => {
    if (role === 'admin') return '/admin';
    if (role === 'nutritionist') return '/nutritionist-dashboard';
    return '/dashboard';
};

const ProtectedRoute: React.FC<{ children: React.ReactNode; allowedRoles?: string[] }> = ({ children, allowedRoles }) => {
    const { user, loading } = useAuth();
    const location = useLocation();

    if (loading) return (
        <div className="min-h-screen flex items-center justify-center bg-slate-50">
            <div className="w-16 h-16 border-4 border-emerald-200 border-t-emerald-600 rounded-full animate-spin"></div>
        </div>
    );

    if (!user) return <Navigate to="/login" replace />;

    if (allowedRoles && !allowedRoles.includes(user.role)) {
        const defaultPath = getDefaultPath(user.role);
        // Avoid redirect loop if we are already trying to access an invalid subpath of our default path
        if (location.pathname.startsWith(defaultPath)) {
            return <Navigate to={`${defaultPath}?error=access-denied`} replace />;
        }
        return <Navigate to={defaultPath} replace />;
    }

    return <>{children}</>;
};

const ProfileGuard: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const { user } = useAuth();
    if (!user) return <Navigate to="/login" replace />;
    if (user.profileComplete) return <Navigate to={getDefaultPath(user.role)} replace />;
    return <>{children}</>;
};

const PublicRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const { user, loading } = useAuth();
    
    if (loading) return (
        <div className="min-h-screen flex items-center justify-center bg-slate-50">
            <div className="w-16 h-16 border-4 border-emerald-200 border-t-emerald-600 rounded-full animate-spin"></div>
        </div>
    );
    
    if (user) {
        if (!user.profileComplete && user.role === 'user') {
            return <Navigate to="/profile-setup" replace />;
        }
        return <Navigate to={getDefaultPath(user.role)} replace />;
    }
    
    return <>{children}</>;
};

const App: React.FC = () => {
    return (
        <AuthProvider>
            <Router>
                <Routes>
                    {/* Public/Auth Routes */}
                    <Route path="/register" element={<PublicRoute><Register /></PublicRoute>} />
                    <Route path="/login" element={<PublicRoute><Login /></PublicRoute>} />
                    <Route path="/forgot-password" element={<PublicRoute><ForgotPassword /></PublicRoute>} />
                    <Route path="/reset-password" element={<PublicRoute><ResetPassword /></PublicRoute>} />
                    
                    {/* Protected Routes */}
                    <Route path="/profile-setup" element={<ProfileGuard><ProfileSetup /></ProfileGuard>} />
                    <Route path="/dashboard/*" element={<ProtectedRoute allowedRoles={['user']}><Dashboard /></ProtectedRoute>} />
                    <Route path="/admin/*" element={<ProtectedRoute allowedRoles={['admin']}><AdminPanel /></ProtectedRoute>} />
                    <Route path="/nutritionist-dashboard/*" element={<ProtectedRoute allowedRoles={['nutritionist']}><NutritionistPanel /></ProtectedRoute>} />
                    
                    {/* Fallback Routes */}
                    <Route path="/" element={<PublicRoute><Navigate to="/login" replace /></PublicRoute>} />
                    <Route path="*" element={<Navigate to="/" replace />} />
                </Routes>
            </Router>
        </AuthProvider>
    );
};

export default App;
