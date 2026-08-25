import React, { useEffect, useState } from "react";
import {
  getUserDetections,
  deleteDetection,
  DetectionHistoryItem,
} from "../services/firestore";
import { useAuth } from "../context/AuthContext";
import Badge from "../atoms/Badge";

type FilterType = "all" | "7days" | "today";

const DetectionHistory: React.FC = () => {
  const { user } = useAuth();
  const [history, setHistory] = useState<DetectionHistoryItem[]>([]);
  const [filter, setFilter] = useState<FilterType>("7days");
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!user) return;

    const fetchHistory = async () => {
      setIsLoading(true);
      setError(null);
      try {
        let daysFilter: number | undefined;
        if (filter === "today") daysFilter = 1;
        else if (filter === "7days") daysFilter = 7;
        else if (filter === "all") daysFilter = undefined;

        const data = await getUserDetections(user.uid, daysFilter);
        setHistory(data);
      } catch (err) {
        console.error(err);
        setError("Failed to load detection history.");
      } finally {
        setIsLoading(false);
      }
    };

    fetchHistory();
  }, [user, filter]);

  const handleDelete = async (id: string) => {
    if (!window.confirm("Are you sure you want to delete this log?")) return;
    try {
      await deleteDetection(id);
      setHistory((prev) => prev.filter((item) => item.id !== id));
    } catch (err) {
      console.error("Failed to delete:", err);
    }
  };

  if (!user) {
    return (
      <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-8 text-center text-slate-500">
        Log in to view your food detection history.
      </div>
    );
  }

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden flex flex-col mt-8">
      <div className="px-6 py-5 border-b border-slate-100 flex flex-col md:flex-row items-center justify-between gap-4 bg-slate-50/50">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-emerald-100 text-emerald-600 rounded-lg">
            <svg
              className="w-5 h-5"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="2"
                d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
              />
            </svg>
          </div>
          <h2 className="text-lg font-bold text-slate-800">
            Detection History
          </h2>
        </div>

        {/* Filter Buttons */}
        <div className="flex bg-slate-100 p-1 rounded-xl">
          <button
            onClick={() => setFilter("today")}
            className={`text-xs font-semibold px-4 py-2 rounded-lg transition-all ${
              filter === "today"
                ? "bg-white text-emerald-600 shadow-sm"
                : "text-slate-500 hover:text-slate-700"
            }`}
          >
            Today
          </button>
          <button
            onClick={() => setFilter("7days")}
            className={`text-xs font-semibold px-4 py-2 rounded-lg transition-all ${
              filter === "7days"
                ? "bg-white text-emerald-600 shadow-sm"
                : "text-slate-500 hover:text-slate-700"
            }`}
          >
            Last 7 Days
          </button>
          <button
            onClick={() => setFilter("all")}
            className={`text-xs font-semibold px-4 py-2 rounded-lg transition-all ${
              filter === "all"
                ? "bg-white text-emerald-600 shadow-sm"
                : "text-slate-500 hover:text-slate-700"
            }`}
          >
            All Time
          </button>
        </div>
      </div>

      <div className="p-6 text-sm text-slate-600">
        {isLoading ? (
          <div className="flex justify-center py-10">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-emerald-500"></div>
          </div>
        ) : error ? (
          <p className="text-center text-red-500 py-6">{error}</p>
        ) : history.length === 0 ? (
          <div className="text-center py-10 opacity-60">
            <svg
              className="w-16 h-16 mx-auto mb-4 text-slate-300"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={1}
                d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 002-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10"
              />
            </svg>
            <p className="font-medium text-slate-500">
              No detections found for this period.
            </p>
            <p className="text-xs text-slate-400 mt-1">
              Upload a meal image above to get started.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {history.map((item) => (
              <div
                key={item.id}
                className="bg-white border text-sm border-slate-200 rounded-2xl p-4 hover:shadow-md transition-shadow"
              >
                <div className="flex justify-between items-start mb-3 border-b border-slate-100 pb-3">
                  <div>
                    <p className="font-semibold text-slate-800 text-base flex items-center gap-2">
                      {item.nutrition.totalCalories > 0 ? (
                        <span className="text-emerald-600 font-bold">
                          {item.nutrition.totalCalories} kcal
                        </span>
                      ) : (
                        <span className="text-slate-400 font-medium">
                          Unknown kcal
                        </span>
                      )}
                    </p>
                    <p className="text-xs text-slate-500 mt-1 font-medium">
                      {item.createdAt.toLocaleDateString(undefined, {
                        month: "short",
                        day: "numeric",
                        year: "numeric",
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </p>
                    <div className="mt-2 text-xs font-semibold px-2 py-0.5 rounded-full bg-blue-50 text-blue-600 inline-block">
                      {item.meal}
                    </div>
                  </div>
                  <div className="flex flex-col items-end gap-2">
                    <Badge color={item.foods.length > 0 ? "green" : "gray"}>
                      {item.foods.length} items
                    </Badge>
                    <button
                      onClick={() => handleDelete(item.id)}
                      className="text-xs text-red-500 hover:text-red-700 transition"
                      title="Delete Log"
                    >
                      Delete
                    </button>
                  </div>
                </div>
                <div className="space-y-2">
                  {item.foods.length > 0 ? (
                    item.foods.map((food, idx) => (
                      <div
                        key={idx}
                        className="flex justify-between items-center bg-slate-50 p-2 rounded-lg border border-slate-100"
                      >
                        <span className="font-medium text-slate-700 capitalize text-xs">
                          {food.name.replace(/_/g, " ")}
                        </span>
                        <span className="text-xs font-bold text-slate-500">
                          {Math.round((food.confidence || 0) * 100)}%
                        </span>
                      </div>
                    ))
                  ) : (
                    <p className="text-xs text-center text-slate-400 italic py-2">
                      No food items detected
                    </p>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default DetectionHistory;
