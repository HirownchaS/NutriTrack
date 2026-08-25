import React, { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import Card from "../atoms/Card";
import Button from "../atoms/Button";
import { useNotification } from "../context/NotificationContext";
import { getAllUsers, deleteNutritionist } from "../services/admin";
import { collection, query, where, getDocs } from "firebase/firestore";
import { db } from "../firebase/config";
import {
  FiUserPlus,
  FiCheckCircle,
  FiEye,
  FiTrash2,
  FiX,
  FiBriefcase,
  FiAward,
} from "react-icons/fi";

interface User {
  id: string;
  name: string;
  email: string;
  role: string;
  specialization?: string;
  experience?: string;
  [key: string]: any;
}

interface NutriStats {
  activeClients: number;
  planSuccess: number;
  assignedUsersCount: number;
}

// modal component
const Modal: React.FC<{
  isOpen: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
}> = ({ isOpen, onClose, title, children }) => {
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
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
      <div
        ref={ref}
        className="bg-white rounded-2xl shadow-2xl w-full max-w-md max-h-[90vh] overflow-y-auto"
      >
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 sticky top-0 bg-white z-10">
          <h2 className="text-base font-black text-slate-800">{title}</h2>
          <button
            onClick={onClose}
            className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-slate-100 text-slate-400 hover:text-slate-700 transition-colors"
          >
            <FiX className="w-4 h-4" />
          </button>
        </div>
        <div className="px-6 py-5">{children}</div>
      </div>
    </div>
  );
};

const AdminNutritionistManagement: React.FC = () => {
  const navigate = useNavigate();
  const [nutritionists, setNutritionists] = useState<User[]>([]);
  const [nutriStats, setNutriStats] = useState<Record<string, NutriStats>>({});
  const { error } = useNotification();
  const [loading, setLoading] = useState(true);
  const [selectedNutri, setSelectedNutri] = useState<User | null>(null);
  const [isViewModalOpen, setIsViewModalOpen] = useState(false);

  const fetchData = async () => {
    setLoading(true);
    try {
      const res = await getAllUsers();
      const allUsers = res.data as User[];
      const nutris = allUsers.filter((u: User) => u.role === "nutritionist");
      setNutritionists(nutris);

      const [reqs, users, plans] = await Promise.all([
        getDocs(
          query(
            collection(db, "nutritionist_requests"),
            where("status", "==", "accepted"),
          ),
        ),
        getDocs(query(collection(db, "users"), where("role", "==", "user"))),
        getDocs(collection(db, "diet_recommendations")),
      ]);

      const hasPlan = new Set(plans.docs.map((d) => d.data().userId));
      const active = {} as any,
        assigned = {} as any,
        success = {} as any;

      reqs.forEach((doc) => {
        const nid = doc.data().nutritionistId;
        if (!nid) return;
        active[nid] = (active[nid] || 0) + 1;
        if (hasPlan.has(doc.data().userId))
          success[nid] = (success[nid] || 0) + 1;
      });

      users.forEach((doc) => {
        const nid =
          doc.data().nutritionistId || doc.data().assignedNutritionistId;
        if (nid) {
          if (!assigned[nid]) assigned[nid] = new Set();
          assigned[nid].add(doc.id);
        }
      });

      const stats = {} as any;
      nutris.forEach((n) => {
        const act = active[n.id] || 0;
        stats[n.id] = {
          activeClients: act,
          planSuccess:
            act > 0 ? Math.round(((success[n.id] || 0) / act) * 100) : 0,
          assignedUsersCount: assigned[n.id]?.size || 0,
        };
      });
      setNutriStats(stats);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const onDelete = async (n: User) => {
    if (!confirm(`Delete "${n.name}"?`)) return;
    try {
      await deleteNutritionist(n.id);
      fetchData();
    } catch (e: any) {
      error(e.message || "Failed to delete nutritionist. Please try again.");
    }
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex justify-between items-end">
        <div>
          <h2 className="text-2xl font-black text-slate-800 tracking-tight">
            Nutritionists
          </h2>
          <p className="text-slate-500 text-sm font-medium mt-1">
            Manage healthcare providers and verify credentials.
          </p>
        </div>
      </div>

      <Card className="overflow-hidden shadow-xl">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-50 border-b border-slate-100 text-slate-500 uppercase font-black text-[10px] tracking-wider">
              <tr>
                <th className="px-6 py-4">Nutritionist</th>
                <th className="px-6 py-4">Email</th>
                <th className="px-6 py-4">Specialization</th>
                <th className="px-6 py-4">Experience</th>
                <th className="px-6 py-4">Assigned Users</th>
                <th className="px-6 py-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {nutritionists.map((n) => {
                const s = nutriStats[n.id] || { assignedUsersCount: 0 };
                return (
                  <tr
                    key={n.id}
                    className="hover:bg-emerald-50/30 transition-colors"
                  >
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-emerald-100 flex items-center justify-center font-black text-emerald-600 text-sm shadow-sm uppercase">
                          {(n.name || "U")[0]}
                        </div>
                        <p className="font-bold text-slate-800 truncate max-w-[150px]">
                          {n.name || "Unnamed User"}
                        </p>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-slate-500 font-medium">
                      {n.email}
                    </td>
                    <td className="px-6 py-4">
                      <span className="px-2.5 py-1 rounded-lg bg-blue-50 text-blue-700 border border-blue-100 text-[10px] font-black uppercase tracking-wider">
                        {n.specialization || "Not specified"}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-slate-600 font-medium">
                      {n.experience || "Not specified"}
                    </td>
                    <td className="px-6 py-4 font-black text-slate-700">
                      {s.assignedUsersCount} users
                    </td>
                    <td className="px-6 py-4 text-right">
                      <div className="flex justify-end gap-1">
                        <button
                          onClick={() => {
                            setSelectedNutri(n);
                            setIsViewModalOpen(true);
                          }}
                          className="p-2 text-slate-400 hover:text-blue-600 rounded-lg"
                        >
                          <FiEye className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => onDelete(n)}
                          className="p-2 text-slate-400 hover:text-rose-600 rounded-lg"
                        >
                          <FiTrash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        {loading && (
          <div className="p-12 text-center">
            <div className="w-8 h-8 border-4 border-emerald-200 border-t-emerald-600 rounded-full animate-spin mx-auto" />
          </div>
        )}
      </Card>

      <Modal
        isOpen={isViewModalOpen}
        onClose={() => setIsViewModalOpen(false)}
        title="Nutritionist Profile"
      >
        {selectedNutri && (
          <div className="space-y-6">
            <div className="flex items-center gap-4 p-4 bg-emerald-50 rounded-xl border border-emerald-100">
              <div className="w-16 h-16 rounded-2xl bg-emerald-600 flex items-center justify-center text-white text-2xl font-black shadow-lg">
                {(selectedNutri.name || "U")[0]}
              </div>
              <div>
                <h3 className="text-xl font-black text-slate-800 leading-tight">
                  {selectedNutri.name || "Unnamed User"}
                </h3>
                <p className="text-slate-500 font-medium text-sm">
                  {selectedNutri.email}
                </p>
                <div className="mt-2 flex gap-2">
                  <span className="px-2 py-0.5 bg-blue-100 text-blue-700 text-[10px] font-black rounded-lg uppercase tracking-wider">
                    Nutritionist
                  </span>
                  <span className="px-2 py-0.5 bg-emerald-100 text-emerald-700 text-[10px] font-black rounded-lg uppercase tracking-wider flex items-center gap-1">
                    <FiCheckCircle className="w-2.5 h-2.5" /> Verified
                  </span>
                </div>
              </div>
            </div>
            <div className="grid gap-4">
              <div className="flex items-center gap-3 p-3 bg-slate-50 rounded-xl border border-slate-200">
                <div className="w-10 h-10 rounded-lg bg-white flex items-center justify-center text-slate-400 shadow-sm">
                  <FiAward className="w-5 h-5" />
                </div>
                <div>
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                    Specialization
                  </p>
                  <p className="text-sm font-black text-slate-700">
                    {selectedNutri.specialization || "Not specified"}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-3 p-3 bg-slate-50 rounded-xl border border-slate-200">
                <div className="w-10 h-10 rounded-lg bg-white flex items-center justify-center text-slate-400 shadow-sm">
                  <FiBriefcase className="w-5 h-5" />
                </div>
                <div>
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                    Experience
                  </p>
                  <p className="text-sm font-black text-slate-700">
                    {selectedNutri.experience || "Not specified"}
                  </p>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 text-center">
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                    Total Clients
                  </p>
                  <p className="text-xl font-black text-emerald-600">
                    {nutriStats[selectedNutri.id]?.assignedUsersCount || 0}
                  </p>
                </div>
                <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 text-center">
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                    Success Rate
                  </p>
                  <p className="text-xl font-black text-blue-600">
                    {nutriStats[selectedNutri.id]?.planSuccess || 0}%
                  </p>
                </div>
              </div>
            </div>
            <Button
              variant="primary"
              className="w-full bg-emerald-600 py-3 font-bold"
              onClick={() => setIsViewModalOpen(false)}
            >
              Done
            </Button>
          </div>
        )}
      </Modal>
    </div>
  );
};

export default AdminNutritionistManagement;
