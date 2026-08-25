import React from "react";
import { Routes, Route, Navigate } from "react-router-dom";
import DashboardLayout from "../organisms/DashboardLayout";
import NutritionistDashboard from "../organisms/NutritionistDashboard";
import NutritionistUsers from "../organisms/NutritionistUsers";
import NutritionistLogReview from "../organisms/NutritionistLogReview";
import NutritionistDietPlan from "../organisms/NutritionistDietPlan";
import NutritionistUserProgress from "../organisms/NutritionistUserProgress";
import Profile from "./Profile";
import Card from "../atoms/Card";
import ChatModule from "../molecules/ChatModule";

const NutritionistPanel: React.FC = () => {
  return (
    <DashboardLayout>
      <Routes>
        <Route
          index
          element={<Navigate to="/nutritionist-dashboard/home" replace />}
        />

        <Route path="home" element={<NutritionistDashboard />} />

        <Route path="users" element={<NutritionistUsers />} />

        <Route path="review-logs" element={<NutritionistLogReview />} />
        <Route path="diet-plans" element={<NutritionistDietPlan />} />
        <Route path="progress" element={<NutritionistUserProgress />} />

        {/* User Messaging */}
        <Route
          path="chat"
          element={
            <div className="space-y-8 animate-fade-in">
              <div>
                <h2 className="text-2xl font-black text-slate-800 tracking-tight">
                  User Messaging
                </h2>
                <p className="text-slate-500 text-sm font-medium mt-1">
                  Direct communication with your assigned portal users.
                </p>
              </div>
              <ChatModule recipientId="" recipientName="Select a User" />
            </div>
          }
        />

        <Route path="all-users" element={<AllUsersPlaceholder />} />

        <Route path="profile" element={<Profile />} />

        <Route
          path="*"
          element={<Navigate to="/nutritionist-dashboard/home" replace />}
        />
      </Routes>
    </DashboardLayout>
  );
};

// --- Sub-Section Components ---

const AllUsersPlaceholder: React.FC = () => (
  <div className="space-y-6 animate-fade-in">
    <div>
      <h2 className="text-2xl font-black text-slate-800 tracking-tight">
        System Global View
      </h2>
      <p className="text-slate-500 text-sm font-medium mt-1">
        Limited read-only access to all NutriTrack users.
      </p>
    </div>
    <Card className="p-12 text-center border-dashed border-2 border-slate-200 bg-slate-50">
      <p className="text-slate-400 font-medium italic">
        Global user search and basic profiling will be implemented here for
        reference.
      </p>
    </Card>
  </div>
);

export default NutritionistPanel;
