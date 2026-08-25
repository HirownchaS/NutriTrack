import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import Card from "../atoms/Card";
import { getAssignedUsers, handleUserRequest } from "../services/nutritionist";
import {
  FiUserCheck,
  FiUserX,
  FiTarget,
  FiArrowRight,
  FiMail,
  FiClock,
  FiInbox,
  FiMessageCircle,
} from "react-icons/fi";
import { useAuth } from "../context/AuthContext";
import { collection, query, where, onSnapshot } from "firebase/firestore";
import { db } from "../firebase/config";

interface UserRequest {
  id: string;
  userId: string;
  name: string;
  email: string;
  age: number | null;
  weight: number | null;
  healthCondition: string;
  fitnessGoal: string;
  status: string;
  date: string;
}

const STATUS_STYLES: Record<string, string> = {
  pending: "bg-orange-100 text-orange-600",
  accepted: "bg-emerald-100 text-emerald-600",
  rejected: "bg-rose-100 text-rose-600",
};

const NutritionistUsers: React.FC = () => {
  const navigate = useNavigate();
  const [pendingRequests, setPendingRequests] = useState<UserRequest[]>([]);
  const [assignedUsers, setAssignedUsers] = useState<UserRequest[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [processingId, setProcessingId] = useState<string | null>(null);
  const [toast, setToast] = useState<{
    message: string;
    type: "success" | "error";
  } | null>(null);

  const { user } = useAuth();

  useEffect(() => {
    let unsubRequests = () => {};

    const setupRealtimeSync = async () => {
      if (!user) return;
      try {
        // 1. Listen to nutritionist requests (handles pending requests using duplicated user data)
        const qRequests = query(
          collection(db, "nutritionist_requests"),
          where("nutritionistId", "==", user.uid),
        );

        unsubRequests = onSnapshot(
          qRequests,
          (snapshot) => {
            const pending = snapshot.docs
              .map((docSnap) => {
                const rData = docSnap.data();
                return {
                  id: docSnap.id,
                  userId: rData.userId,
                  name: rData.name || "Unknown User",
                  email: rData.email || "No email",
                  age: rData.age || null,
                  weight: rData.weight || null,
                  healthCondition: rData.healthCondition || "None specified",
                  fitnessGoal: rData.fitnessGoal || "None specified",
                  status: rData.status,
                  date: rData.createdAt?.toDate
                    ? rData.createdAt.toDate().toLocaleDateString()
                    : "Just now",
                };
              })
              .filter((r) => r.status === "pending");

            setPendingRequests(pending);
          },
          (error) => {
            console.error("Requests sync error:", error);
          },
        );

        const result = await getAssignedUsers();
        setAssignedUsers(result.data.assigned);
        setLoading(false);
      } catch (err) {
        console.error("Setup listener error", err);
        setLoading(false);
      }
    };

    setupRealtimeSync();
    return () => {
      unsubRequests();
    };
  }, [user]);

  useEffect(() => {
    if (toast) {
      const timer = setTimeout(() => setToast(null), 3500);
      return () => clearTimeout(timer);
    }
  }, [toast]);

  const handleRequest = async (id: string, status: "accepted" | "rejected") => {
    setProcessingId(id);
    try {
      await handleUserRequest(id, status);
      const result = await getAssignedUsers();
      setAssignedUsers(result.data.assigned);
      setToast({
        message:
          status === "accepted"
            ? "✅ Request accepted!"
            : "❌ Request rejected.",
        type: status === "accepted" ? "success" : "error",
      });
    } catch (err: any) {
      console.error("UI Request Error:", err);
      setToast({
        message: err.message || "Action failed.",
        type: "error",
      });
    } finally {
      setProcessingId(null);
    }
  };

  const openChat = (userId: string, userName: string) => {
    navigate("/nutritionist-dashboard/chat", {
      state: { recipientId: userId, recipientName: userName },
    });
  };

  if (loading) {
    return (
      <div className="p-12 text-center">
        <div className="w-10 h-10 border-4 border-emerald-200 border-t-emerald-600 rounded-full animate-spin mx-auto mb-4"></div>
        <p className="text-slate-400 text-sm font-medium">Loading users...</p>
      </div>
    );
  }

  return (
    <div className="space-y-10 animate-fade-in">
      {toast && (
        <div
          className={`fixed top-6 right-6 z-50 px-5 py-3.5 rounded-2xl shadow-2xl text-sm font-bold animate-fade-in ${
            toast.type === "success"
              ? "bg-emerald-600 text-white"
              : "bg-rose-500 text-white"
          }`}
        >
          {toast.message}
        </div>
      )}

      <section>
        <h2 className="text-xl font-black text-slate-800 mb-6 flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-orange-500 animate-pulse"></span>
          Pending User Requests
          {pendingRequests.length > 0 && (
            <span className="ml-2 px-2.5 py-0.5 text-xs font-black bg-orange-100 text-orange-600 rounded-full">
              {pendingRequests.length}
            </span>
          )}
        </h2>

        {pendingRequests.length === 0 ? (
          <Card className="p-12 text-center border-dashed border-2 border-slate-200 bg-slate-50/50">
            <FiInbox className="w-10 h-10 text-slate-300 mx-auto mb-3" />
            <p className="text-slate-400 font-bold">No pending requests</p>
          </Card>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {pendingRequests.map((req) => (
              <Card
                key={req.id}
                className="overflow-hidden border border-slate-100 group"
              >
                <div className="bg-orange-50 px-6 py-4 border-b border-orange-100/50 flex justify-between items-center">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-orange-500 flex items-center justify-center text-white font-black">
                      {req.name[0]}
                    </div>
                    <div>
                      <h3 className="font-black text-slate-800 text-sm">
                        {req.name}
                      </h3>
                      <span className="text-[10px] font-black uppercase px-2 py-0.5 rounded-full bg-orange-100 text-orange-600">
                        {req.status}
                      </span>
                    </div>
                  </div>
                  <div className="text-slate-300 text-[10px] flex items-center gap-1">
                    <FiClock /> {req.date}
                  </div>
                </div>
                <div className="px-6 py-5 space-y-3">
                  <div className="flex items-center gap-3 text-xs">
                    <FiMail className="text-slate-400" />
                    <span className="font-bold text-slate-700">
                      {req.email}
                    </span>
                  </div>
                  <div className="flex items-center gap-3 text-xs">
                    <FiTarget className="text-slate-400" />
                    <span className="font-bold text-slate-700">
                      {req.fitnessGoal} ({req.age || "?"}y, {req.weight || "?"}
                      kg)
                    </span>
                  </div>
                  <div className="text-[10px] bg-slate-100 p-2 rounded-lg text-slate-500 font-medium">
                    <span className="font-black text-slate-700 uppercase mr-1">
                      Condition:
                    </span>
                    {req.healthCondition}
                  </div>
                </div>
                <div className="px-6 py-4 bg-slate-50/50 border-t border-slate-100 flex gap-3">
                  <button
                    onClick={() => handleRequest(req.id, "rejected")}
                    disabled={!!processingId}
                    className="flex-1 py-2 rounded-xl text-xs font-bold text-rose-600 bg-rose-50 hover:bg-rose-100 border border-rose-100"
                  >
                    Reject
                  </button>
                  <button
                    onClick={() => handleRequest(req.id, "accepted")}
                    disabled={!!processingId}
                    className="flex-1 py-2 rounded-xl text-xs font-bold text-white bg-emerald-500 hover:bg-emerald-600"
                  >
                    Accept
                  </button>
                </div>
              </Card>
            ))}
          </div>
        )}
      </section>

      <section>
        <h2 className="text-xl font-black text-slate-800 mb-6 flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
          My Assigned Users
          {assignedUsers.length > 0 && (
            <span className="ml-2 px-2.5 py-0.5 text-xs font-black bg-emerald-100 text-emerald-600 rounded-full">
              {assignedUsers.length}
            </span>
          )}
        </h2>

        {assignedUsers.length === 0 ? (
          <Card className="p-12 text-center border-dashed border-2 border-slate-200 bg-slate-50/50">
            <FiInbox className="w-10 h-10 text-slate-300 mx-auto mb-3" />
            <p className="text-slate-400 font-bold">No assigned users</p>
          </Card>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {assignedUsers.map((u) => (
              <Card
                key={u.id}
                className="p-6 hover:shadow-lg transition-all border-emerald-50/50"
              >
                <div className="flex items-center gap-4 mb-6">
                  <div className="w-12 h-12 rounded-2xl bg-emerald-100 flex items-center justify-center text-emerald-600 font-black text-xl">
                    {u.name[0]}
                  </div>
                  <div>
                    <h3 className="font-bold text-slate-800">{u.name}</h3>
                    <span className="text-[10px] font-black uppercase px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-600">
                      Active User
                    </span>
                  </div>
                </div>
                <div className="space-y-2 mb-6 text-xs">
                  <div className="flex justify-between">
                    <span className="text-slate-400 font-bold">Goal</span>
                    <span className="text-slate-700 font-black">
                      {u.fitnessGoal}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400 font-bold">Profile</span>
                    <span className="text-slate-700 font-black">
                      {u.age}y | {u.weight}kg
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400 font-bold">Health</span>
                    <span className="text-slate-700 font-black truncate max-w-[120px]">
                      {u.healthCondition}
                    </span>
                  </div>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() =>
                      navigate(
                        `/nutritionist-dashboard/progress?userId=${u.userId}`,
                      )
                    }
                    className="flex-1 py-2 px-2 bg-slate-50 text-slate-600 rounded-xl text-[10px] font-black border border-slate-100 hover:bg-emerald-50 hover:text-emerald-600 transition-all flex items-center justify-center gap-1"
                  >
                    Profile <FiArrowRight />
                  </button>
                  <button
                    onClick={() => openChat(u.userId, u.name)}
                    className="flex-1 py-2 px-2 bg-emerald-500 text-white rounded-xl text-[10px] font-black shadow-md hover:bg-emerald-600 transition-all flex items-center justify-center gap-1"
                  >
                    Chat <FiMessageCircle />
                  </button>
                </div>
              </Card>
            ))}
          </div>
        )}
      </section>
    </div>
  );
};

export default NutritionistUsers;
