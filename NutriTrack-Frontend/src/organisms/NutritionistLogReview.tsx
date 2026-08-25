import React, { useState, useEffect } from "react";
import Card from "../atoms/Card";
import { collection, query, where, getDocs, orderBy } from "firebase/firestore";
import { db } from "../firebase/config";
import Button from "../atoms/Button";
import { useNotification } from "../context/NotificationContext";
import {
  getAssignedUsers,
  getUserFullData,
  approveFoodLog,
} from "../services/nutritionist";
import { FiCheckCircle, FiXCircle, FiEdit3, FiCalendar } from "react-icons/fi";

interface User {
  userId: string;
  name: string;
}

interface FoodLog {
  id: string;
  foodName: string;
  imageUrl: string;
  date: string;
  calories: number;
  protein: number;
  carbs: number;
  fats: number;
  status: "pending" | "approved" | "rejected";
  nutritionist_feedback?: string;
}

const NutritionistLogReview: React.FC = () => {
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
  const [users, setUsers] = useState<User[]>([]);
  const [logData, setLogData] = useState<FoodLog[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [auditFeedback, setAuditFeedback] = useState<Record<string, string>>(
    {},
  );
  const [error, setError] = useState<string | null>(null);
  const { success, error: notifyError } = useNotification();

  const [stats, setStats] = useState({ totalCalories: 0, avgCalories: 0 });

  useEffect(() => {
    const fetchUsers = async () => {
      try {
        setLoading(true);
        setError(null);
        const res = await getAssignedUsers();
        setUsers(res.data.assigned);
        if (res.data.assigned.length > 0)
          setSelectedUserId(res.data.assigned[0].userId);
      } catch (err: any) {
        console.error("Failed to load users:", err);
        setError("Failed to load user list.");
      } finally {
        setLoading(false);
      }
    };
    fetchUsers();
  }, []);

  useEffect(() => {
    if (!selectedUserId) return;
    const fetchLogs = async () => {
      try {
        setLoading(true);
        setError(null);

        const q = query(
          collection(db, "food_logs"),
          where("userId", "==", selectedUserId),
          orderBy("createdAt", "desc"),
        );

        let snap;
        try {
          snap = await getDocs(q);
        } catch (e) {
          console.warn(
            "Permission denied or missing index for logs, falling back to empty:",
            e,
          );
          snap = { docs: [] }; // Handle gracefully if rules deny access or index missing
        }

        const logs = snap.docs.map((doc: any) => {
          const data = doc.data();
          return {
            id: doc.id,
            foodName: data.foodName || "Unknown Food",
            imageUrl: data.imageUrl || "",
            calories: data.calories || 0,
            protein: data.protein || 0,
            carbs: data.carbs || 0,
            fats: data.fats || 0,
            date: data.createdAt?.toDate
              ? data.createdAt.toDate().toLocaleDateString()
              : "Just now",
            status: data.status || "pending",
            nutritionist_feedback: data.nutritionist_feedback || "",
            mealType: (data.mealType || "snacks").toLowerCase(),
          };
        }) as any[];

        const total = logs.reduce(
          (acc: any, log: any) => acc + log.calories,
          0,
        );
        const avg = logs.length > 0 ? Math.round(total / logs.length) : 0;

        setLogData(logs);
        setStats({ totalCalories: total, avgCalories: avg });
      } catch (err: any) {
        console.error("Failed to load logs:", err);
        setError("Failed to load food logs.");
      } finally {
        setLoading(false);
      }
    };
    fetchLogs();
  }, [selectedUserId]);

  const handleAudit = async (
    logId: string,
    status: "approved" | "rejected",
  ) => {
    try {
      const feedback = auditFeedback[logId] || "";
      await approveFoodLog(logId, status, feedback);
      success(`Log ${status} successfully!`);
      setLogData((prev) =>
        prev.map((log) =>
          log.id === logId
            ? { ...log, status, nutritionist_feedback: feedback }
            : log,
        ),
      );
    } catch (error: any) {
      notifyError("Failed to update log: " + error.message);
    }
  };

  const handleFeedbackChange = (logId: string, value: string) => {
    setAuditFeedback((prev) => ({ ...prev, [logId]: value }));
  };

  return (
    <div className="space-y-8 animate-fade-in">
      {/* User Selector */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h2 className="text-2xl font-black text-slate-800 tracking-tight">
            Food Log Audit
          </h2>
          <p className="text-slate-500 text-sm font-medium mt-1">
            Review AI detections and verify nutritional accuracy.
          </p>
        </div>
        {users.length > 0 && (
          <div className="flex items-center gap-4">
            <div className="hidden md:flex gap-4 mr-4">
              <div className="text-right">
                <p className="text-[10px] font-black text-slate-400 uppercase">
                  Total Kcal
                </p>
                <p className="text-sm font-black text-emerald-600">
                  {stats.totalCalories}
                </p>
              </div>
              <div className="text-right border-l border-slate-100 pl-4">
                <p className="text-[10px] font-black text-slate-400 uppercase">
                  Avg Kcal
                </p>
                <p className="text-sm font-black text-blue-600">
                  {stats.avgCalories}
                </p>
              </div>
            </div>
            <select
              className="bg-white border border-slate-200 rounded-xl px-4 py-2.5 pr-10 text-sm font-bold shadow-sm focus:ring-2 focus:ring-emerald-500 outline-none appearance-none -webkit-appearance-none -moz-appearance-none custom-select"
              value={selectedUserId || ""}
              onChange={(e) => setSelectedUserId(e.target.value)}
            >
              {users.map((u) => (
                <option key={u.userId} value={u.userId}>
                  {u.name}
                </option>
              ))}
            </select>
          </div>
        )}
      </div>

      {error && (
        <div className="p-4 bg-rose-50 text-rose-600 rounded-2xl border border-rose-100 font-medium animate-shake">
          {error}
        </div>
      )}

      {loading ? (
        <div className="p-12 text-center">
          <div className="w-8 h-8 border-4 border-emerald-200 border-t-emerald-600 rounded-full animate-spin mx-auto"></div>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-8">
          {["breakfast", "lunch", "dinner", "snacks"].map((mealType) => {
            const logs = logData.filter(
              (log: any) => log.mealType === mealType,
            );
            if (logs.length === 0) return null;
            return (
              <div key={mealType} className="space-y-4">
                <h3 className="font-black text-slate-400 uppercase tracking-widest text-xs flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
                  {mealType}
                </h3>
                {logs.map((log: any) => (
                  <Card
                    key={log.id}
                    className="p-6 border-emerald-50 flex flex-col md:flex-row gap-6 hover:shadow-md transition-shadow"
                  >
                    {/* <div className="w-full md:w-32 h-32 bg-slate-100 rounded-2xl overflow-hidden flex items-center justify-center text-slate-400 italic text-xs text-center border border-slate-100">
                                            {log.imageUrl ? (
                                                <img src={log.imageUrl} alt={log.foodName} className="w-full h-full object-cover" />
                                            ) : (
                                                <span>No Image</span>
                                            )}
                                        </div> */}

                    <div className="flex-1 flex flex-col justify-between">
                      <div>
                        <div className="flex items-center gap-3 mb-2">
                          <h3 className="text-lg font-black text-slate-800">
                            {log.foodName}
                          </h3>
                          <span className="text-[10px] text-slate-400 font-bold bg-slate-50 px-2 py-0.5 rounded flex items-center gap-1">
                            <FiCalendar /> {log.date}
                          </span>
                        </div>
                        <div className="flex gap-3 text-xs">
                          <span className="text-emerald-600 font-black">
                            {log.calories} kcal
                          </span>
                          <span className="text-slate-400 font-bold">
                            P: {log.protein}g
                          </span>
                          <span className="text-slate-400 font-bold">
                            C: {log.carbs}g
                          </span>
                          <span className="text-slate-400 font-bold">
                            F: {log.fats}g
                          </span>
                        </div>
                      </div>

                      <div className="mt-4 flex gap-2">
                        <Button
                          variant="secondary"
                          className="px-3 py-1.5 text-[10px] border-slate-200"
                          onClick={() => {
                            const val = prompt("Enter adjustment details:");
                            if (val)
                              handleFeedbackChange(
                                log.id,
                                (auditFeedback[log.id] || "") +
                                  " [Adj: " +
                                  val +
                                  "]",
                              );
                          }}
                        >
                          <FiEdit3 className="mr-1.5" /> Adjust
                        </Button>
                        <div className="flex flex-col gap-2 w-full mt-2">
                          <input
                            type="text"
                            placeholder="Add advice..."
                            className="text-xs p-2 border border-slate-200 rounded-lg outline-none focus:ring-1 focus:ring-emerald-500"
                            value={auditFeedback[log.id] || ""}
                            onChange={(e) =>
                              handleFeedbackChange(log.id, e.target.value)
                            }
                          />
                        </div>
                      </div>
                    </div>

                    <div className="flex flex-row md:flex-col justify-center gap-3 border-t md:border-t-0 md:border-l border-slate-100 pt-4 md:pt-0 md:pl-6">
                      {log.status === "pending" ? (
                        <>
                          <Button
                            onClick={() => handleAudit(log.id, "approved")}
                            className="bg-emerald-500 hover:bg-emerald-600 text-white"
                          >
                            <FiCheckCircle className="mr-2" /> Approve
                          </Button>
                          <Button
                            onClick={() => handleAudit(log.id, "rejected")}
                            variant="secondary"
                            className="text-rose-500 border-rose-100 hover:bg-rose-50"
                          >
                            <FiXCircle className="mr-2" /> Reject
                          </Button>
                        </>
                      ) : (
                        <div
                          className={`flex items-center gap-2 px-4 py-2 rounded-xl border font-black uppercase tracking-widest text-[10px] ${log.status === "approved" ? "bg-emerald-50 text-emerald-600 border-emerald-100" : "bg-rose-50 text-rose-600 border-rose-100"}`}
                        >
                          {log.status === "approved" ? (
                            <FiCheckCircle />
                          ) : (
                            <FiXCircle />
                          )}
                          {log.status}
                        </div>
                      )}
                    </div>
                  </Card>
                ))}
              </div>
            );
          })}
          {logData.length === 0 && (
            <Card className="p-12 text-center text-slate-400 italic bg-slate-50/50 border-dashed border-2">
              No recent logs found for this user.
            </Card>
          )}
        </div>
      )}
    </div>
  );
};

export default NutritionistLogReview;
