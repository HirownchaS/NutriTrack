import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import Card from "../atoms/Card";
import { useAuth } from "../context/AuthContext";
import { getAssignedUsers } from "../services/nutritionist";
import {
  collection,
  query,
  where,
  getDocs,
  getDoc,
  doc,
  limit,
  orderBy,
  onSnapshot,
} from "firebase/firestore";
import { db } from "../firebase/config";
import {
  FiUsers,
  FiInbox,
  FiFileText,
  FiActivity,
  FiArrowRight,
  FiCheckSquare,
  FiMessageSquare,
  FiFilePlus,
  FiPieChart,
  FiBarChart2,
} from "react-icons/fi";

interface DashboardStats {
  assignedUsers: number;
  pendingRequests: number;
  activePlans: number;
  recentActivityCount: number;
}

interface ActivityItem {
  id: number;
  type: string;
  userName: string;
  action: string;
  time: string;
  icon: string;
}

interface ApprovalPoint {
  label: string;
  value: number;
  color: string;
}

interface DailyCaloriesPoint {
  label: string;
  value: number;
}

const buildApprovalChartData = (
  logs: Array<{ status?: string }>,
): ApprovalPoint[] => {
  const counts = { Approved: 0, Rejected: 0, Pending: 0 };

  logs.forEach((log) => {
    const normalizedStatus = String(log.status || "pending").toLowerCase();
    if (normalizedStatus === "approved") counts.Approved += 1;
    else if (normalizedStatus === "rejected") counts.Rejected += 1;
    else counts.Pending += 1;
  });

  return [
    { label: "Approved", value: counts.Approved, color: "#10b981" },
    { label: "Rejected", value: counts.Rejected, color: "#ef4444" },
    { label: "Pending", value: counts.Pending, color: "#f59e0b" },
  ];
};

const buildAverageCaloriesData = (
  logs: Array<{
    userId?: string;
    calories?: number;
    createdAt?: { toDate?: () => Date };
  }>,
  assignedUserCount: number,
): DailyCaloriesPoint[] => {
  const last7Days = Array.from({ length: 7 }, (_, index) => {
    const day = new Date();
    day.setDate(day.getDate() - (6 - index));
    return {
      key: `${day.getFullYear()}-${day.getMonth() + 1}-${day.getDate()}`,
      label: day.toLocaleDateString("en-US", { weekday: "short" }),
      totalCalories: 0,
    };
  });

  logs.forEach((log) => {
    const createdAt = log.createdAt?.toDate?.();
    if (!createdAt) return;

    const key = `${createdAt.getFullYear()}-${createdAt.getMonth() + 1}-${createdAt.getDate()}`;
    const dayBucket = last7Days.find((entry) => entry.key === key);
    if (dayBucket) {
      dayBucket.totalCalories += Number(log.calories || 0);
    }
  });

  return last7Days.map((item) => ({
    label: item.label,
    value:
      assignedUserCount > 0
        ? Math.round(item.totalCalories / assignedUserCount)
        : 0,
  }));
};

const ApprovalChart: React.FC<{ data: ApprovalPoint[] }> = ({ data }) => {
  const total = data.reduce((sum, item) => sum + item.value, 0);

  if (!data.length || total === 0) {
    return <p className="text-sm text-slate-500">No data available</p>;
  }

  const radius = 42;
  const circumference = 2 * Math.PI * radius;
  let offset = 0;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-center">
        <svg viewBox="0 0 140 140" className="w-40 h-40">
          <circle
            cx="70"
            cy="70"
            r={radius}
            fill="none"
            stroke="#e2e8f0"
            strokeWidth="20"
          />
          {data.map((item) => {
            const valueLength =
              total > 0 ? (item.value / total) * circumference : 0;
            const circle = (
              <circle
                key={item.label}
                cx="70"
                cy="70"
                r={radius}
                fill="none"
                stroke={item.color}
                strokeWidth="20"
                strokeLinecap="round"
                strokeDasharray={`${valueLength} ${circumference}`}
                strokeDashoffset={-offset}
                transform="rotate(-90 70 70)"
              />
            );
            offset += valueLength;
            return circle;
          })}
        </svg>
      </div>
      <div className="space-y-2">
        {data.map((item) => (
          <div
            key={item.label}
            className="flex items-center justify-between text-sm text-slate-600"
          >
            <div className="flex items-center gap-2">
              <span
                className="w-3 h-3 rounded-full"
                style={{ backgroundColor: item.color }}
              />
              <span>{item.label}</span>
            </div>
            <span className="font-semibold text-slate-800">{item.value}</span>
          </div>
        ))}
      </div>
    </div>
  );
};

const AverageCaloriesChart: React.FC<{ data: DailyCaloriesPoint[] }> = ({
  data,
}) => {
  const maxValue = Math.max(...data.map((item) => item.value), 1);

  if (!data.length || data.every((item) => item.value === 0)) {
    return <p className="text-sm text-slate-500">No data available</p>;
  }

  return (
    <div className="w-full">
      <svg viewBox="0 0 320 180" className="w-full h-48">
        <line
          x1="20"
          y1="150"
          x2="300"
          y2="150"
          stroke="#cbd5e1"
          strokeWidth="1"
        />
        {data.map((item, index) => {
          const barWidth = 32;
          const gap = 20;
          const x = 30 + index * (barWidth + gap);
          const height = (item.value / maxValue) * 110;
          const y = 150 - height;

          return (
            <g key={item.label}>
              <rect
                x={x}
                y={y}
                width={barWidth}
                height={height}
                rx="8"
                fill="#10b981"
                opacity="0.9"
              />
              <text
                x={x + barWidth / 2}
                y="168"
                textAnchor="middle"
                className="fill-slate-500 text-[10px] font-semibold"
              >
                {item.label}
              </text>
              <text
                x={x + barWidth / 2}
                y={y - 8}
                textAnchor="middle"
                className="fill-slate-700 text-[10px] font-bold"
              >
                {item.value}
              </text>
            </g>
          );
        })}
      </svg>
    </div>
  );
};

// ---- Component ----

const NutritionistDashboard: React.FC = () => {
  const [loading, setLoading] = useState<boolean>(true);
  const navigate = useNavigate();

  const { user } = useAuth();
  const [stats, setStats] = useState<DashboardStats>({
    assignedUsers: 0,
    pendingRequests: 0,
    activePlans: 0,
    recentActivityCount: 0,
  });
  const [recentActivity, setRecentActivity] = useState<ActivityItem[]>([]);
  const [approvalData, setApprovalData] = useState<ApprovalPoint[]>([]);
  const [dailyCaloriesData, setDailyCaloriesData] = useState<
    DailyCaloriesPoint[]
  >([]);

  useEffect(() => {
    if (!user) return;

    let isMounted = true;
    const unsubscribeFns: Array<() => void> = [];
    const logsById = new Map<string, Record<string, any>>();

    const fetchData = async () => {
      setLoading(true);
      try {
        const assignedData = await getAssignedUsers();
        const assignedCount = assignedData.data.assigned.length;
        const userIds = assignedData.data.assigned.map(
          (assignedUser) => assignedUser.userId,
        );
        const pendingCount = assignedData.data.requests.length;

        let activePlansCount = 0;
        if (userIds.length > 0) {
          const planPromises = userIds.map(async (uid) => {
            try {
              const planDoc = await getDoc(
                doc(db, "diet_recommendations", uid),
              );
              if (planDoc.exists()) {
                const status = planDoc.data().status;
                if (status === "approved" || status === "active" || !status) {
                  return 1;
                }
              }
            } catch (e) {
              console.warn(`Failed to fetch plan for user ${uid}:`, e);
            }
            return 0;
          });
          const planResults = await Promise.all(planPromises);
          activePlansCount = planResults.reduce((a, b) => a + b, 0);
        }

        const top10UserIds = userIds.slice(0, 10);
        let activity: ActivityItem[] = [];

        if (top10UserIds.length > 0) {
          const logPromises = top10UserIds.map(async (uid) => {
            try {
              const q = query(
                collection(db, "food_logs"),
                where("userId", "==", uid),
                orderBy("createdAt", "desc"),
                limit(5),
              );
              const snap = await getDocs(q);
              return snap.docs;
            } catch (e) {
              console.warn(`Could not fetch logs for user ${uid}:`, e);
              return [];
            }
          });

          const results = await Promise.all(logPromises);
          let allLogs = results.flat();

          allLogs.sort((a, b) => {
            const aTime = a.data().createdAt?.toMillis() || 0;
            const bTime = b.data().createdAt?.toMillis() || 0;
            return bTime - aTime;
          });

          allLogs = allLogs.slice(0, 5);

          const activityPromises = allLogs.map(async (logDoc, idx) => {
            const ld = logDoc.data();
            let userName = "User";
            try {
              const userDoc = await getDoc(doc(db, "users", ld.userId));
              if (userDoc.exists()) userName = userDoc.data().name || "User";
            } catch (e) {
              console.warn(`Failed to fetch user ${ld.userId}:`, e);
            }
            const ts = ld.createdAt?.toDate?.() || new Date();

            return {
              id: idx + 1,
              type: "food_log",
              userName,
              action: `logged ${ld.foodName || "a meal"} (${ld.calories || 0} kcal)`,
              time: ts.toLocaleTimeString([], {
                hour: "2-digit",
                minute: "2-digit",
              }),
              icon: "📸",
            };
          });
          activity = await Promise.all(activityPromises);
        }

        if (isMounted) {
          setStats({
            assignedUsers: assignedCount,
            pendingRequests: pendingCount,
            activePlans: activePlansCount,
            recentActivityCount: activity.length,
          });
          setRecentActivity(activity);
        }

        if (userIds.length === 0) {
          if (isMounted) {
            setApprovalData([]);
            setDailyCaloriesData([]);
          }
          return;
        }

        const batches = Array.from(
          { length: Math.ceil(userIds.length / 10) },
          (_, index) => userIds.slice(index * 10, index * 10 + 10),
        );

        batches.forEach((batch) => {
          const foodLogsQuery = query(
            collection(db, "food_logs"),
            where("userId", "in", batch),
          );

          const unsubscribe = onSnapshot(
            foodLogsQuery,
            (snapshot) => {
              snapshot.docChanges().forEach((change) => {
                if (change.type === "removed") {
                  logsById.delete(change.doc.id);
                } else {
                  logsById.set(change.doc.id, change.doc.data());
                }
              });

              const logs = Array.from(logsById.values());
              if (isMounted) {
                setApprovalData(buildApprovalChartData(logs));
                setDailyCaloriesData(
                  buildAverageCaloriesData(logs, userIds.length),
                );
              }
            },
            (error) => {
              console.warn("Failed to subscribe to food logs:", error);
            },
          );

          unsubscribeFns.push(unsubscribe);
        });
      } catch (err) {
        console.error("Failed to load dashboard", err);
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    };

    fetchData();

    return () => {
      isMounted = false;
      unsubscribeFns.forEach((unsubscribe) => unsubscribe());
    };
  }, [user]);

  if (loading) {
    return (
      <div className="p-12 text-center">
        <div className="w-10 h-10 border-4 border-emerald-200 border-t-emerald-600 rounded-full animate-spin mx-auto"></div>
      </div>
    );
  }

  const statCards = [
    {
      label: "Assigned Users",
      value: stats.assignedUsers,
      icon: FiUsers,
      gradient: "from-emerald-500 to-teal-600",
      bgIcon: "bg-emerald-100 text-emerald-600",
    },
    {
      label: "Pending Requests",
      value: stats.pendingRequests,
      icon: FiInbox,
      gradient: "from-orange-500 to-amber-500",
      bgIcon: "bg-orange-100 text-orange-600",
    },
    {
      label: "Active Plans",
      value: stats.activePlans,
      icon: FiFileText,
      gradient: "from-blue-500 to-indigo-600",
      bgIcon: "bg-blue-100 text-blue-600",
    },
    {
      label: "Recent Activity",
      value: stats.recentActivityCount,
      icon: FiActivity,
      gradient: "from-purple-500 to-violet-600",
      bgIcon: "bg-purple-100 text-purple-600",
    },
  ];

  const quickActions = [
    {
      label: "Manage Users",
      to: "/nutritionist-dashboard/users",
      icon: FiUsers,
      color: "text-emerald-600 bg-emerald-50 hover:bg-emerald-100",
    },
    {
      label: "Review Food Logs",
      to: "/nutritionist-dashboard/review-logs",
      icon: FiCheckSquare,
      color: "text-blue-600 bg-blue-50 hover:bg-blue-100",
    },
    {
      label: "Diet Plans",
      to: "/nutritionist-dashboard/diet-plans",
      icon: FiFilePlus,
      color: "text-orange-600 bg-orange-50 hover:bg-orange-100",
    },
    {
      label: "Messages",
      to: "/nutritionist-dashboard/chat",
      icon: FiMessageSquare,
      color: "text-purple-600 bg-purple-50 hover:bg-purple-100",
    },
  ];

  return (
    <div className="space-y-8 animate-fade-in">
      {/* Header */}
      <div>
        <h1 className="text-2xl md:text-3xl font-black text-slate-800 tracking-tight">
          Dashboard Overview 👨‍⚕️
        </h1>
        <p className="text-slate-500 mt-1 text-sm font-medium">
          Welcome back! Here's a snapshot of your practice today.
        </p>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {statCards.map((card) => (
          <Card
            key={card.label}
            className="relative overflow-hidden p-5 hover:-translate-y-1 transition-all duration-300 group"
          >
            <div
              className={`absolute top-0 right-0 w-24 h-24 bg-gradient-to-br ${card.gradient} rounded-full opacity-10 -translate-y-8 translate-x-8 group-hover:scale-150 transition-transform duration-500`}
            ></div>
            <div className="relative z-10">
              <div
                className={`w-10 h-10 rounded-xl ${card.bgIcon} flex items-center justify-center mb-3`}
              >
                <card.icon className="w-5 h-5" />
              </div>
              <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">
                {card.label}
              </p>
              <p className="text-3xl font-black text-slate-800 mt-1">
                {card.value}
              </p>
            </div>
          </Card>
        ))}
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        <Card className="p-6">
          <div className="flex items-center gap-2 mb-5">
            <div className="w-9 h-9 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
              <FiPieChart className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-700 uppercase tracking-wider">
                Food Log Approval Analytics
              </h3>
              <p className="text-xs text-slate-400 font-medium">
                Assigned users by review status
              </p>
            </div>
          </div>
          <ApprovalChart data={approvalData} />
        </Card>

        <Card className="p-6">
          <div className="flex items-center gap-2 mb-5">
            <div className="w-9 h-9 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center">
              <FiBarChart2 className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-700 uppercase tracking-wider">
                Average Daily Calories
              </h3>
              <p className="text-xs text-slate-400 font-medium">
                Last 7 days from food logs
              </p>
            </div>
          </div>
          <AverageCaloriesChart data={dailyCaloriesData} />
        </Card>
      </div>

      {/* Two-column layout: Activity Feed + Quick Actions */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Activity Feed (2/3) */}
        <Card className="lg:col-span-2 p-6">
          <h3 className="text-sm font-bold text-slate-700 uppercase tracking-wider mb-5 flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
            Recent Activity
          </h3>
          <div className="space-y-1">
            {recentActivity.map((item) => (
              <div
                key={item.id}
                className="flex items-center gap-4 p-3.5 rounded-xl hover:bg-slate-50 transition-colors duration-200 group"
              >
                <div className="w-10 h-10 rounded-xl bg-slate-100 flex items-center justify-center text-lg flex-shrink-0 group-hover:scale-110 transition-transform duration-200">
                  {item.icon}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-slate-800 truncate">
                    <span className="font-bold">{item.userName}</span>{" "}
                    <span className="text-slate-500">{item.action}</span>
                  </p>
                  <p className="text-xs text-slate-400 font-medium mt-0.5">
                    {item.time}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </Card>

        {/* Quick Actions (1/3) */}
        <Card className="p-6">
          <h3 className="text-sm font-bold text-slate-700 uppercase tracking-wider mb-5 flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-blue-500"></span>
            Quick Actions
          </h3>
          <div className="space-y-3">
            {quickActions.map((action) => (
              <button
                key={action.label}
                onClick={() => navigate(action.to)}
                className={`w-full flex items-center gap-3 p-3.5 rounded-xl text-left transition-all duration-200 group ${action.color}`}
              >
                <action.icon className="w-5 h-5 flex-shrink-0" />
                <span className="text-sm font-bold flex-1">{action.label}</span>
                <FiArrowRight className="w-4 h-4 opacity-0 group-hover:opacity-100 transition-opacity duration-200" />
              </button>
            ))}
          </div>
        </Card>
      </div>
    </div>
  );
};

export default NutritionistDashboard;
