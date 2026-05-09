import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import DashboardLayout from '../organisms/DashboardLayout';
import AdminAnalytics from '../organisms/AdminAnalytics';
import AdminUserManagement from '../organisms/AdminUserManagement';
import AdminNutritionistManagement from '../organisms/AdminNutritionistManagement';
import AdminAddNutritionist from '../organisms/AdminAddNutritionist';
// import AdminFoodDatabase from '../organisms/AdminFoodDatabase';
import AdminAIControl from '../organisms/AdminAIControl';
import AdminLogMonitor from '../organisms/AdminLogMonitor';
import Profile from './Profile';
import Card from '../atoms/Card';
import Button from '../atoms/Button';


const AdminPanel: React.FC = () => {
    return (
        <DashboardLayout>
            <Routes>
                {/* Default to Analytics */}
                <Route index element={<Navigate to="analytics" replace />} />

                {/* Analytics Dashboard */}
                <Route path="analytics" element={<AdminAnalytics />} />

                {/* Manage All Users */}
                <Route path="users" element={<AdminUserManagement />} />

                {/* Manage Nutritionists */}
                <Route path="nutritionists" element={<AdminNutritionistManagement />} />

                {/* Add Nutritionist */}
                <Route path="add-nutritionist" element={<AdminAddNutritionist />} />

                {/* Food Database Management
                <Route path="food-database" element={<AdminFoodDatabase />} /> */}

                {/* AI Model Management */}
                <Route path="ai-control" element={<AdminAIControl />} />

                {/* Tracking Reports */}
                <Route path="tracking-reports" element={<AdminLogMonitor />} />

                {/* Profile Section */}
                <Route path="profile" element={<Profile />} />

                {/* Fallback */}
                <Route path="*" element={<Navigate to="analytics" replace />} />
            </Routes>
        </DashboardLayout>
    );
};

// --- Sub-Section Components (Internal to AdminPanel for now) ---

export const RoleManagementSection: React.FC = () => (
    <div className="space-y-6 animate-fade-in">
        <div>
            <h2 className="text-2xl font-black text-slate-800 tracking-tight">Role Management</h2>
            <p className="text-slate-500 text-sm font-medium mt-1">Elevate users to Nutritionists or Admins.</p>
        </div>
        <Card className="p-12 text-center border-dashed border-2 border-slate-200 bg-slate-50">
            <p className="text-slate-400 font-medium italic">No pending role elevations at this time.</p>
        </Card>
    </div>
);

export const SystemSettingsSection: React.FC = () => (
    <div className="space-y-6 animate-fade-in">
        <div>
            <h2 className="text-2xl font-black text-slate-800 tracking-tight">System Settings</h2>
            <p className="text-slate-500 text-sm font-medium mt-1">Configure calorie database and recommendation algorithms.</p>
        </div>
        <Card className="p-8 space-y-4">
            <h3 className="font-bold text-slate-800">Calorie Database Rules</h3>
            <div className="p-4 bg-emerald-50 rounded-xl border border-emerald-100 text-emerald-700 text-sm">
                Current Mode: **AI Auto-Detection (Priority)**
            </div>
            <Button variant="primary" className="bg-emerald-600 hover:bg-emerald-700">Apply Changes</Button>
        </Card>
    </div>
);

export default AdminPanel;
