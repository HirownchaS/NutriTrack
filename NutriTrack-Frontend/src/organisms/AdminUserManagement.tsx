import React, { useState, useEffect, useCallback, useRef } from "react";
import {
  collection,
  getDocs,
  doc,
  getDoc,
  deleteDoc,
  updateDoc,
} from "firebase/firestore";
import { db, auth } from "../firebase/config";
import { goalsMatch } from "../services/goalMatching";
import Card from "../atoms/Card";
import Button from "../atoms/Button";
import {
  FiSearch,
  FiEye,
  FiEdit2,
  FiTrash2,
  FiX,
  FiUser,
  FiMail,
  FiShield,
  FiActivity,
  FiTarget,
  FiUserCheck,
  FiAlertTriangle,
  FiCheck,
  FiChevronLeft,
  FiChevronRight,
  FiRefreshCw,
  FiSliders,
  FiUsers,
} from "react-icons/fi";

interface FirestoreUser {
  uid: string;
  name: string;
  email: string;
  role: "user" | "nutritionist" | "admin";
  age?: number;
  weight?: number;
  height?: number;
  gender?: string;
  fitnessGoal?: string;
  specialization?: string;
  healthCondition?: string;
  nutritionistId?: string;
  assignedNutritionistName?: string; // resolved after fetch
  dailyCalorieGoal?: number;
  lastActive?: { seconds: number } | null;
  createdAt?: { seconds: number } | null;
  [key: string]: any;
}

type ModalType = "view" | "edit" | "delete" | null;

interface ToastItem {
  id: number;
  message: string;
  type: "success" | "error";
}

// Toast System

const ToastContainer: React.FC<{
  toasts: ToastItem[];
  onRemove: (id: number) => void;
}> = ({ toasts, onRemove }) => (
  <div className="fixed top-5 right-5 z-[200] space-y-2 pointer-events-none">
    {toasts.map((t) => (
      <div
        key={t.id}
        className={`flex items-center gap-3 px-4 py-3 rounded-xl shadow-xl text-sm font-bold pointer-events-auto animate-fade-in transition-all
                    ${t.type === "success" ? "bg-emerald-600 text-white" : "bg-red-500 text-white"}`}
      >
        {t.type === "success" ? (
          <FiCheck className="w-4 h-4 flex-shrink-0" />
        ) : (
          <FiAlertTriangle className="w-4 h-4 flex-shrink-0" />
        )}
        <span>{t.message}</span>
        <button
          onClick={() => onRemove(t.id)}
          className="ml-2 opacity-70 hover:opacity-100 transition-opacity"
        >
          <FiX className="w-3 h-3" />
        </button>
      </div>
    ))}
  </div>
);

//modal

const Modal: React.FC<{
  isOpen: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
  wide?: boolean;
}> = ({ isOpen, onClose, title, children, wide = false }) => {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    if (isOpen) document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm"
      onClick={(e) => {
        if (ref.current && !ref.current.contains(e.target as Node)) onClose();
      }}
    >
      <div
        ref={ref}
        className={`bg-white rounded-2xl shadow-2xl w-full ${wide ? "max-w-2xl" : "max-w-md"} max-h-[90vh] overflow-y-auto animate-fade-in`}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 sticky top-0 bg-white z-10">
          <h2 className="text-base font-black text-slate-800">{title}</h2>
          <button
            onClick={onClose}
            className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-slate-100 text-slate-400 hover:text-slate-700 transition-colors"
            aria-label="Close modal"
          >
            <FiX className="w-4 h-4" />
          </button>
        </div>
        <div className="px-6 py-5">{children}</div>
      </div>
    </div>
  );
};

// ─────────────────────────────────────────────
// Role Badge
// ─────────────────────────────────────────────

const RoleBadge: React.FC<{ role: string }> = ({ role }) => {
  const config: Record<string, string> = {
    admin: "bg-purple-100 text-purple-700 border border-purple-200",
    nutritionist: "bg-blue-100 text-blue-700 border border-blue-200",
    user: "bg-emerald-100 text-emerald-700 border border-emerald-200",
  };
  return (
    <span
      className={`px-2.5 py-1 rounded-lg text-[10px] font-black uppercase tracking-wider ${config[role] ?? config.user}`}
    >
      {role}
    </span>
  );
};

// Detail Row (for view modal)

const DetailRow: React.FC<{
  icon: React.ReactNode;
  label: string;
  value: React.ReactNode;
}> = ({ icon, label, value }) => (
  <div className="flex items-start gap-3 py-3 border-b border-slate-50 last:border-0">
    <div className="w-8 h-8 bg-slate-50 rounded-lg flex items-center justify-center text-slate-400 flex-shrink-0 mt-0.5">
      {icon}
    </div>
    <div className="min-w-0 flex-1">
      <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
        {label}
      </p>
      <div className="text-sm font-bold text-slate-800 mt-0.5 break-words">
        {value}
      </div>
    </div>
  </div>
);

// Constants

const PAGE_SIZE = 10;
const ROLES = ["user", "nutritionist", "admin"] as const;

// Main Component

const AdminUserManagement: React.FC = () => {
  const [users, setUsers] = useState<FirestoreUser[]>([]);
  const [nutritionists, setNutritionists] = useState<
    { uid: string; name: string; specialization?: string }[]
  >([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [roleFilter, setRoleFilter] = useState<string>("all");
  const [page, setPage] = useState(1);
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const [selectedUser, setSelectedUser] = useState<FirestoreUser | null>(null);
  const [modalType, setModalType] = useState<ModalType>(null);
  const [actionLoading, setActionLoading] = useState(false);

  // Edit form state
  const [editRole, setEditRole] = useState<string>("user");
  const [editNutritionistId, setEditNutritionistId] = useState<string>("");
  const [editCalorieGoal, setEditCalorieGoal] = useState<string>("");

  // ── Toast helpers ──────────────────────────────
  const toastCounter = useRef(0);
  const addToast = useCallback((message: string, type: "success" | "error") => {
    const id = ++toastCounter.current;
    setToasts((prev) => [...prev, { id, message, type }]);
    setTimeout(
      () => setToasts((prev) => prev.filter((t) => t.id !== id)),
      4000,
    );
  }, []);
  const removeToast = useCallback(
    (id: number) => setToasts((prev) => prev.filter((t) => t.id !== id)),
    [],
  );

  // ── Fetch all users + resolve nutritionist names ──
  const fetchUsers = useCallback(async () => {
    const user = auth.currentUser;
    if (!user) {
      setError("You must be logged in to access this page.");
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const snap = await getDocs(collection(db, "users"));
      const raw: FirestoreUser[] = snap.docs.map((d) => {
        const data = d.data();
        return {
          uid: d.id,
          ...data,
          name: data.name || "Unknown",
          email: data.email || "—",
          role: data.role || "user",
          nutritionistId:
            data.nutritionistId || data.assignedNutritionistId || "",
          dailyCalorieGoal: data.dailyCalorieGoal || data.calorieGoal,
          lastActive: data.lastActive ?? null,
          createdAt: data.createdAt ?? null,
        };
      });

      // Resolve assigned nutritionist names (only unique IDs)
      const idsToFetch = [
        ...new Set(raw.map((u) => u.nutritionistId).filter(Boolean)),
      ] as string[];
      const nameMap: Record<string, string> = {};
      await Promise.all(
        idsToFetch.map(async (id) => {
          try {
            const d = await getDoc(doc(db, "users", id));
            nameMap[id] = d.exists() ? d.data().name || "Unknown" : "Unknown";
          } catch {
            nameMap[id] = "Unknown";
          }
        }),
      );

      const resolved = raw.map((u) => ({
        ...u,
        assignedNutritionistName: u.nutritionistId
          ? (nameMap[u.nutritionistId] ?? "Unknown")
          : "Not Assigned",
      }));

      setUsers(resolved);

      // Extract nutritionist list for the edit dropdown
      setNutritionists(
        resolved
          .filter((u) => u.role === "nutritionist")
          .map((u) => ({
            uid: u.uid,
            name: u.name,
            specialization: u.specialization,
          })),
      );
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Failed to load users";
      setError(msg);
      addToast(msg, "error");
    } finally {
      setLoading(false);
    }
  }, [addToast]);

  useEffect(() => {
    fetchUsers();
  }, [fetchUsers]);

  // ── Filtering + Pagination ──────────────────────
  const filtered = users.filter((u) => {
    const term = searchTerm.toLowerCase();
    const matchSearch =
      u.name.toLowerCase().includes(term) ||
      u.email.toLowerCase().includes(term);
    const matchRole = roleFilter === "all" || u.role === roleFilter;
    return matchSearch && matchRole;
  });

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const paginated = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  const suitableNutritionists = selectedUser?.fitnessGoal
    ? nutritionists.filter(
        (n) =>
          typeof n.specialization === "string" &&
          goalsMatch(selectedUser.fitnessGoal || "", n.specialization),
      )
    : [];

  // Reset to page 1 on filter change
  useEffect(() => setPage(1), [searchTerm, roleFilter]);

  // ── Modal helpers ──────────────────────────────
  const openModal = (user: FirestoreUser, type: ModalType) => {
    setSelectedUser(user);
    setModalType(type);
    if (type === "edit") {
      setEditRole(user.role);
      setEditNutritionistId(user.nutritionistId ?? "");
      setEditCalorieGoal(
        user.dailyCalorieGoal !== undefined
          ? String(user.dailyCalorieGoal)
          : "",
      );
    }
  };

  const closeModal = () => {
    setSelectedUser(null);
    setModalType(null);
    setActionLoading(false);
  };

  //Delete
  const handleDelete = async () => {
    if (!selectedUser) return;
    setActionLoading(true);
    try {
      await deleteDoc(doc(db, "users", selectedUser.uid));
      setUsers((prev) => prev.filter((u) => u.uid !== selectedUser.uid));
      addToast(`User "${selectedUser.name}" deleted successfully.`, "success");
      closeModal();
    } catch (err) {
      addToast(
        "Failed to delete user: " +
          (err instanceof Error ? err.message : String(err)),
        "error",
      );
      setActionLoading(false);
    }
  };

  // Edit / Save
  const handleSave = async () => {
    if (!selectedUser) return;
    setActionLoading(true);
    try {
      const updates: Record<string, unknown> = {
        role: editRole,
        nutritionistId: editNutritionistId || null,
        dailyCalorieGoal: editCalorieGoal ? Number(editCalorieGoal) : null,
      };
      await updateDoc(doc(db, "users", selectedUser.uid), updates);

      const newNutriName = editNutritionistId
        ? (nutritionists.find((n) => n.uid === editNutritionistId)?.name ??
          "Unknown")
        : "Not Assigned";

      setUsers((prev) =>
        prev.map((u) =>
          u.uid === selectedUser.uid
            ? {
                ...u,
                role: editRole as FirestoreUser["role"],
                nutritionistId: editNutritionistId,
                assignedNutritionistName: newNutriName,
                dailyCalorieGoal: editCalorieGoal
                  ? Number(editCalorieGoal)
                  : undefined,
              }
            : u,
        ),
      );
      addToast(`User "${selectedUser.name}" updated successfully.`, "success");
      closeModal();
    } catch (err) {
      addToast(
        "Failed to update user: " +
          (err instanceof Error ? err.message : String(err)),
        "error",
      );
      setActionLoading(false);
    }
  };

  // ── Format timestamp ───────────────────────────
  const formatDate = (ts?: { seconds: number } | null) => {
    if (!ts?.seconds) return "—";
    return new Date(ts.seconds * 1000).toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  };

  // Render

  return (
    <>
      <ToastContainer toasts={toasts} onRemove={removeToast} />

      <div className="space-y-6 animate-fade-in">
        {/* ── Header ── */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div>
            <h2 className="text-2xl font-black text-slate-800 tracking-tight flex items-center gap-2">
              <FiUsers className="w-6 h-6 text-emerald-600" /> System Users
            </h2>
            <p className="text-slate-500 text-sm font-medium mt-1">
              Manage accounts, roles, and nutritionist assignments directly from
              Firestore.
            </p>
          </div>

          {/* Controls row */}
          <div className="flex flex-wrap items-center gap-3 w-full md:w-auto">
            {/* Search */}
            <div className="relative flex-1 min-w-[200px] md:w-60">
              <FiSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 w-4 h-4 pointer-events-none" />
              <input
                type="text"
                placeholder="Search name or email…"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-9 pr-4 py-2.5 bg-white border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-emerald-500 outline-none transition-all"
              />
            </div>

            {/* Role filter */}
            <div className="relative">
              <FiSliders className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 w-3.5 h-3.5 pointer-events-none" />
              <select
                value={roleFilter}
                onChange={(e) => setRoleFilter(e.target.value)}
                className="pl-8 pr-10 py-2.5 bg-white border border-slate-200 rounded-xl text-sm outline-none focus:ring-2 focus:ring-emerald-500 appearance-none -webkit-appearance-none -moz-appearance-none custom-select cursor-pointer"
              >
                <option value="all">All Roles</option>
                <option value="user">Users</option>
                <option value="nutritionist">Nutritionists</option>
                <option value="admin">Admins</option>
              </select>
            </div>

            {/* Refresh */}
            <button
              onClick={fetchUsers}
              disabled={loading}
              className="p-2.5 bg-white border border-slate-200 rounded-xl text-slate-500 hover:text-emerald-600 hover:border-emerald-300 transition-all disabled:opacity-40"
              title="Refresh"
            >
              <FiRefreshCw
                className={`w-4 h-4 ${loading ? "animate-spin" : ""}`}
              />
            </button>
          </div>
        </div>

        {/* ── Stats Row ── */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[
            {
              label: "Total Users",
              value: users.length,
              color: "text-slate-800",
              bg: "bg-slate-50 border-slate-200",
            },
            {
              label: "Regular Users",
              value: users.filter((u) => u.role === "user").length,
              color: "text-emerald-700",
              bg: "bg-emerald-50 border-emerald-200",
            },
            {
              label: "Nutritionists",
              value: users.filter((u) => u.role === "nutritionist").length,
              color: "text-blue-700",
              bg: "bg-blue-50 border-blue-200",
            },
            {
              label: "Admins",
              value: users.filter((u) => u.role === "admin").length,
              color: "text-purple-700",
              bg: "bg-purple-50 border-purple-200",
            },
          ].map((s) => (
            <div
              key={s.label}
              className={`${s.bg} border rounded-xl px-4 py-3`}
            >
              <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                {s.label}
              </p>
              <p className={`text-2xl font-black mt-0.5 ${s.color}`}>
                {s.value}
              </p>
            </div>
          ))}
        </div>

        {/* ── Table ── */}
        <Card className="overflow-hidden shadow-xl">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-50 border-b border-slate-100 text-slate-500 uppercase font-black text-[10px] tracking-[0.08em]">
                <tr>
                  <th className="px-6 py-4 whitespace-nowrap">User Details</th>
                  <th className="px-6 py-4 whitespace-nowrap">Role</th>
                  <th className="px-6 py-4 whitespace-nowrap">
                    Assigned Nutritionist
                  </th>
                  <th className="px-6 py-4 whitespace-nowrap">
                    Goals / Activity
                  </th>
                  <th className="px-6 py-4 text-right whitespace-nowrap">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {paginated.map((user) => (
                  <tr
                    key={user.uid}
                    className="hover:bg-emerald-50/30 transition-colors group"
                  >
                    {/* User Details */}
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center font-black text-white text-sm shadow-sm flex-shrink-0 uppercase">
                          {user.name[0] || "?"}
                        </div>
                        <div className="min-w-0">
                          <p className="font-bold text-slate-800 truncate max-w-[150px]">
                            {user.name}
                          </p>
                          <p className="text-xs text-slate-400 font-medium truncate max-w-[150px]">
                            {user.email}
                          </p>
                        </div>
                      </div>
                    </td>

                    {/* Role */}
                    <td className="px-6 py-4">
                      <RoleBadge role={user.role} />
                    </td>

                    {/* Assigned Nutritionist */}
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2">
                        <FiUserCheck
                          className={`w-4 h-4 flex-shrink-0 ${user.assignedNutritionistName !== "Not Assigned" ? "text-emerald-500" : "text-slate-300"}`}
                        />
                        <span
                          className={`text-sm font-medium ${user.assignedNutritionistName !== "Not Assigned" ? "text-slate-700" : "text-slate-400 italic"}`}
                        >
                          {user.assignedNutritionistName}
                        </span>
                      </div>
                    </td>

                    {/* Goals / Activity */}
                    <td className="px-6 py-4">
                      <div className="space-y-1">
                        <div className="flex items-center gap-1.5">
                          <FiTarget className="w-3 h-3 text-emerald-500 flex-shrink-0" />
                          <span className="text-xs font-bold text-slate-700">
                            {user.dailyCalorieGoal ? (
                              `${user.dailyCalorieGoal} kcal/day`
                            ) : (
                              <span className="text-slate-400 font-normal italic">
                                No goal set
                              </span>
                            )}
                          </span>
                        </div>
                        <div className="flex items-center gap-1.5">
                          <FiActivity className="w-3 h-3 text-slate-400 flex-shrink-0" />
                          <span className="text-[11px] text-slate-400 font-medium">
                            Last active: {formatDate(user.lastActive)}
                          </span>
                        </div>
                      </div>
                    </td>

                    {/* Actions */}
                    <td className="px-6 py-4">
                      <div className="flex justify-end items-center gap-1">
                        <button
                          onClick={() => openModal(user, "view")}
                          className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-bold text-slate-500 hover:text-blue-600 hover:bg-blue-50 transition-all"
                          title="View user"
                        >
                          <FiEye className="w-3.5 h-3.5" /> View
                        </button>
                        <button
                          onClick={() => openModal(user, "edit")}
                          disabled={user.role === "nutritionist"}
                          className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-bold text-slate-500 hover:text-emerald-600 hover:bg-emerald-50 transition-all"
                          title="Edit user"
                        >
                          <FiEdit2 className="w-3.5 h-3.5" /> Edit
                        </button>
                        <button
                          onClick={() => openModal(user, "delete")}
                          className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-bold text-slate-500 hover:text-red-600 hover:bg-red-50 transition-all"
                          title="Delete user"
                        >
                          <FiTrash2 className="w-3.5 h-3.5" /> Delete
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Loading */}
          {loading && (
            <div className="p-16 text-center">
              <div className="w-10 h-10 border-4 border-emerald-100 border-t-emerald-600 rounded-full animate-spin mx-auto mb-4" />
              <p className="text-slate-400 font-medium animate-pulse text-sm">
                Loading users from Firestore…
              </p>
            </div>
          )}

          {/* Error */}
          {!loading && error && (
            <div className="p-12 text-center">
              <FiAlertTriangle className="w-10 h-10 text-red-400 mx-auto mb-3" />
              <p className="text-red-500 font-bold text-sm">{error}</p>
              <button
                onClick={fetchUsers}
                className="mt-3 text-xs font-bold text-emerald-600 hover:underline"
              >
                Retry
              </button>
            </div>
          )}

          {/* Empty */}
          {!loading && !error && filtered.length === 0 && (
            <div className="p-16 text-center">
              <div className="w-16 h-16 bg-slate-50 rounded-full flex items-center justify-center mx-auto mb-4">
                <FiSearch className="w-8 h-8 text-slate-300" />
              </div>
              <p className="text-slate-400 font-bold text-sm">No users found</p>
              <p className="text-slate-400 text-xs mt-1 italic">
                Try adjusting your search or role filter.
              </p>
            </div>
          )}

          {/* ── Pagination ── */}
          {!loading && filtered.length > PAGE_SIZE && (
            <div className="px-6 py-4 border-t border-slate-100 flex items-center justify-between bg-slate-50/50">
              <p className="text-xs text-slate-500 font-medium">
                Showing{" "}
                <span className="font-black text-slate-700">
                  {(page - 1) * PAGE_SIZE + 1}–
                  {Math.min(page * PAGE_SIZE, filtered.length)}
                </span>{" "}
                of{" "}
                <span className="font-black text-slate-700">
                  {filtered.length}
                </span>{" "}
                users
              </p>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={page === 1}
                  className="w-8 h-8 flex items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-500 hover:border-emerald-400 hover:text-emerald-600 disabled:opacity-40 disabled:cursor-not-allowed transition-all"
                >
                  <FiChevronLeft className="w-4 h-4" />
                </button>

                {/* Page numbers */}
                {Array.from({ length: totalPages }, (_, i) => i + 1)
                  .filter(
                    (p) =>
                      p === 1 || p === totalPages || Math.abs(p - page) <= 1,
                  )
                  .reduce<(number | "...")[]>((acc, p, idx, arr) => {
                    if (idx > 0 && (p as number) - (arr[idx - 1] as number) > 1)
                      acc.push("...");
                    acc.push(p);
                    return acc;
                  }, [])
                  .map((p, i) =>
                    p === "..." ? (
                      <span
                        key={`ellipsis-${i}`}
                        className="w-8 h-8 flex items-center justify-center text-xs text-slate-400"
                      >
                        …
                      </span>
                    ) : (
                      <button
                        key={p}
                        onClick={() => setPage(p as number)}
                        className={`w-8 h-8 flex items-center justify-center rounded-lg text-xs font-bold transition-all
                                                ${page === p ? "bg-emerald-600 text-white shadow-sm" : "border border-slate-200 bg-white text-slate-600 hover:border-emerald-400 hover:text-emerald-600"}`}
                      >
                        {p}
                      </button>
                    ),
                  )}

                <button
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  disabled={page === totalPages}
                  className="w-8 h-8 flex items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-500 hover:border-emerald-400 hover:text-emerald-600 disabled:opacity-40 disabled:cursor-not-allowed transition-all"
                >
                  <FiChevronRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}
        </Card>
      </div>

      {/* view modal */}
      <Modal
        isOpen={modalType === "view"}
        onClose={closeModal}
        title="User Details"
        wide
      >
        {selectedUser && (
          <div>
            {/* Avatar + name banner */}
            <div className="flex items-center gap-4 mb-6 p-4 bg-gradient-to-r from-emerald-50 to-teal-50 rounded-xl border border-emerald-100">
              <div className="w-14 h-14 rounded-xl bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center text-white font-black text-xl uppercase shadow-md">
                {selectedUser.name[0]}
              </div>
              <div>
                <p className="text-lg font-black text-slate-800">
                  {selectedUser.name}
                </p>
                <p className="text-sm text-slate-500">{selectedUser.email}</p>
                <div className="mt-1">
                  <RoleBadge role={selectedUser.role} />
                </div>
              </div>
            </div>

            {/* Details grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-8">
              <div>
                <DetailRow
                  icon={<FiUser className="w-4 h-4" />}
                  label="Name"
                  value={selectedUser.name}
                />
                <DetailRow
                  icon={<FiMail className="w-4 h-4" />}
                  label="Email"
                  value={selectedUser.email}
                />
                <DetailRow
                  icon={<FiShield className="w-4 h-4" />}
                  label="Role"
                  value={<RoleBadge role={selectedUser.role} />}
                />
                <DetailRow
                  icon={<FiActivity className="w-4 h-4" />}
                  label="Age"
                  value={selectedUser.age ? `${selectedUser.age} years` : "—"}
                />
              </div>
              <div>
                <DetailRow
                  icon={<FiActivity className="w-4 h-4" />}
                  label="Weight"
                  value={
                    selectedUser.weight ? `${selectedUser.weight} kg` : "—"
                  }
                />
                <DetailRow
                  icon={<FiActivity className="w-4 h-4" />}
                  label="Height"
                  value={
                    selectedUser.height ? `${selectedUser.height} cm` : "—"
                  }
                />
                <DetailRow
                  icon={<FiUserCheck className="w-4 h-4" />}
                  label="Assigned Nutritionist"
                  value={
                    selectedUser.assignedNutritionistName ?? "Not Assigned"
                  }
                />
                <DetailRow
                  icon={<FiTarget className="w-4 h-4" />}
                  label="Daily Calorie Goal"
                  value={
                    selectedUser.dailyCalorieGoal
                      ? `${selectedUser.dailyCalorieGoal} kcal`
                      : "—"
                  }
                />
                <DetailRow
                  icon={<FiTarget className="w-4 h-4" />}
                  label="Fitness Goal"
                  value={selectedUser.fitnessGoal?.toUpperCase() || "—"}
                />
                <DetailRow
                  icon={<FiActivity className="w-4 h-4" />}
                  label="Health Condition"
                  value={selectedUser.healthCondition?.toUpperCase() || "—"}
                />
              </div>
            </div>
            <div className="mt-2">
              <DetailRow
                icon={<FiActivity className="w-4 h-4" />}
                label="Last Active"
                value={formatDate(selectedUser.lastActive)}
              />
              <DetailRow
                icon={<FiActivity className="w-4 h-4" />}
                label="Account Created"
                value={formatDate(selectedUser.createdAt)}
              />
            </div>

            <div className="mt-6 flex justify-end gap-3">
              <Button variant="secondary" onClick={closeModal}>
                Close
              </Button>
              <Button
                onClick={() => {
                  closeModal();
                  setTimeout(() => openModal(selectedUser, "edit"), 50);
                }}
                disabled={selectedUser.role === "nutritionist"}
              >
                <span className="flex items-center gap-2">
                  <FiEdit2 className="w-3.5 h-3.5" /> Edit User
                </span>
              </Button>
            </div>
          </div>
        )}
      </Modal>

      {/* edit modal */}
      <Modal
        isOpen={modalType === "edit"}
        onClose={closeModal}
        title="Edit User"
        wide
      >
        {selectedUser && (
          <div className="space-y-5">
            {/* User info banner */}
            <div className="flex items-center gap-3 p-3 bg-slate-50 rounded-xl border border-slate-200">
              <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center text-white font-black uppercase text-sm">
                {selectedUser.name[0]}
              </div>
              <div>
                <p className="font-bold text-slate-800 text-sm">
                  {selectedUser.name}
                </p>
                <p className="text-xs text-slate-400">{selectedUser.email}</p>
              </div>
            </div>

            {/* Role */}
            <div>
              <label className="block text-xs font-bold text-slate-600 uppercase tracking-wider mb-1.5">
                Role
              </label>
              <select
                value={editRole}
                onChange={(e) => setEditRole(e.target.value)}
                className="w-full px-4 py-2.5 pr-10 border border-slate-200 rounded-xl text-sm bg-white focus:ring-2 focus:ring-emerald-500 outline-none transition-all appearance-none -webkit-appearance-none -moz-appearance-none custom-select"
              >
                {ROLES.map((r) => (
                  <option key={r} value={r}>
                    {r.charAt(0).toUpperCase() + r.slice(1)}
                  </option>
                ))}
              </select>
            </div>

            {/* Assigned Nutritionist */}
            <div>
              <label className="block text-xs font-bold text-slate-600 uppercase tracking-wider mb-1.5">
                Assigned Nutritionist
              </label>
              <select
                value={editNutritionistId}
                onChange={(e) => setEditNutritionistId(e.target.value)}
                className="w-full px-4 py-2.5 pr-10 border border-slate-200 rounded-xl text-sm bg-white focus:ring-2 focus:ring-emerald-500 outline-none transition-all appearance-none -webkit-appearance-none -moz-appearance-none custom-select"
              >
                <option value="">— Not Assigned —</option>
                {suitableNutritionists.map((n) => (
                  <option key={n.uid} value={n.uid}>
                    {n.name}
                  </option>
                ))}
              </select>
              {suitableNutritionists.length === 0 && (
                <p className="text-[11px] text-slate-400 mt-1 italic">
                  No nutritionists found in Firestore.
                </p>
              )}
            </div>

            {/* Calorie goal */}
            <div>
              <label className="block text-xs font-bold text-slate-600 uppercase tracking-wider mb-1.5">
                Daily Calorie Goal (kcal)
              </label>
              <input
                type="number"
                min="500"
                max="9999"
                placeholder="e.g. 2000"
                value={editCalorieGoal}
                onChange={(e) => setEditCalorieGoal(e.target.value)}
                className="w-full px-4 py-2.5 border border-slate-200 rounded-xl text-sm bg-white focus:ring-2 focus:ring-emerald-500 outline-none transition-all"
              />
            </div>

            <div className="flex justify-end gap-3 pt-2">
              <Button
                variant="secondary"
                onClick={closeModal}
                disabled={actionLoading}
              >
                Cancel
              </Button>
              <Button onClick={handleSave} disabled={actionLoading}>
                {actionLoading ? (
                  <span className="flex items-center gap-2">
                    <svg
                      className="w-4 h-4 animate-spin"
                      fill="none"
                      viewBox="0 0 24 24"
                    >
                      <circle
                        className="opacity-25"
                        cx="12"
                        cy="12"
                        r="10"
                        stroke="currentColor"
                        strokeWidth="4"
                      />
                      <path
                        className="opacity-75"
                        fill="currentColor"
                        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
                      />
                    </svg>
                    Saving…
                  </span>
                ) : (
                  <span className="flex items-center gap-2">
                    <FiCheck className="w-4 h-4" /> Save Changes
                  </span>
                )}
              </Button>
            </div>
          </div>
        )}
      </Modal>

      {/* delete modal */}
      <Modal
        isOpen={modalType === "delete"}
        onClose={closeModal}
        title="Delete User"
      >
        {selectedUser && (
          <div className="space-y-5">
            {/* Warning banner */}
            <div className="flex items-start gap-4 p-4 bg-red-50 rounded-xl border border-red-200">
              <div className="w-10 h-10 rounded-xl bg-red-100 flex items-center justify-center flex-shrink-0">
                <FiAlertTriangle className="w-5 h-5 text-red-600" />
              </div>
              <div>
                <p className="font-black text-red-700 text-sm">
                  This action cannot be undone
                </p>
                <p className="text-xs text-red-500 mt-1">
                  The Firestore document will be permanently deleted.
                </p>
              </div>
            </div>

            <p className="text-sm text-slate-600">
              Are you sure you want to delete the account for{" "}
              <span className="font-black text-slate-800">
                "{selectedUser.name}"
              </span>{" "}
              (<span className="text-slate-500">{selectedUser.email}</span>)?
            </p>

            {/* User card */}
            <div className="flex items-center gap-3 p-3 bg-slate-50 rounded-xl border border-slate-200">
              <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-red-400 to-rose-500 flex items-center justify-center text-white font-black uppercase text-sm">
                {selectedUser.name[0]}
              </div>
              <div>
                <p className="font-bold text-slate-800 text-sm">
                  {selectedUser.name}
                </p>
                <p className="text-xs text-slate-400">
                  {selectedUser.email} · <RoleBadge role={selectedUser.role} />
                </p>
              </div>
            </div>

            <div className="flex justify-end gap-3">
              <Button
                variant="secondary"
                onClick={closeModal}
                disabled={actionLoading}
              >
                Cancel
              </Button>
              <Button
                variant="danger"
                onClick={handleDelete}
                disabled={actionLoading}
              >
                {actionLoading ? (
                  <span className="flex items-center gap-2">
                    <svg
                      className="w-4 h-4 animate-spin"
                      fill="none"
                      viewBox="0 0 24 24"
                    >
                      <circle
                        className="opacity-25"
                        cx="12"
                        cy="12"
                        r="10"
                        stroke="currentColor"
                        strokeWidth="4"
                      />
                      <path
                        className="opacity-75"
                        fill="currentColor"
                        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
                      />
                    </svg>
                    Deleting…
                  </span>
                ) : (
                  <span className="flex items-center gap-2">
                    <FiTrash2 className="w-4 h-4" /> Yes, Delete
                  </span>
                )}
              </Button>
            </div>
          </div>
        )}
      </Modal>
    </>
  );
};

export default AdminUserManagement;
