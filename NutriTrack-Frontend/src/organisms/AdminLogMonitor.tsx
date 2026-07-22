import React, { useState, useEffect, useMemo } from 'react';
import Card from '../atoms/Card';
import Button from '../atoms/Button';
import { getAllUsers, getUserFoodLogs } from '../services/admin';
import { getUserDetections } from '../services/firestore';
import { FiDownloadCloud, FiTrendingUp, FiClock, FiArrowRight, FiUsers, FiPieChart } from 'react-icons/fi';
import {
    Chart as ChartJS,
    CategoryScale,
    LinearScale,
    BarElement,
    PointElement,
    LineElement,
    ArcElement,
    Title,
    Tooltip,
    Legend,
    ChartData,
    ChartOptions
} from 'chart.js';
import { Bar, Doughnut } from 'react-chartjs-2';
import jsPDF from 'jspdf';

ChartJS.register(
    CategoryScale,
    LinearScale,
    BarElement,
    PointElement,
    LineElement,
    ArcElement,
    Title,
    Tooltip,
    Legend
);

type DateRange = 'all' | 'today' | 'week' | 'month';

interface UserRecord {
    id: string;
    name?: string;
    email?: string;
    height?: number;
    weight?: number;
    fitnessGoal?: string;
    dailyCalorieGoal?: number;
    role?: string;
}

interface FoodLogRecord {
    id: string;
    createdAt: Date;
    mealType: string;
    foodName: string;
    calories: number;
    protein: number;
    carbs: number;
    fats: number;
    status?: string;
}

const DATE_OPTIONS: { label: string; value: DateRange }[] = [
    { label: 'Today', value: 'today' },
    { label: 'Past 7 Days', value: 'week' },
    { label: 'Past 30 Days', value: 'month' },
    { label: 'All Time', value: 'all' },
];

const statusStyles: Record<string, string> = {
    approved: 'bg-emerald-50 text-emerald-700',
    rejected: 'bg-rose-50 text-rose-700',
    pending: 'bg-slate-50 text-slate-600',
};

const AdminLogMonitor: React.FC = () => {
    const [users, setUsers] = useState<UserRecord[]>([]);
    const [selectedUserId, setSelectedUserId] = useState<string>('');
    const [logs, setLogs] = useState<FoodLogRecord[]>([]);
    const [detections, setDetections] = useState<any[]>([]);
    const [dateRange, setDateRange] = useState<DateRange>('week');
    const [loadingUsers, setLoadingUsers] = useState<boolean>(true);
    const [loadingLogs, setLoadingLogs] = useState<boolean>(false);
    const [loadingMore, setLoadingMore] = useState<boolean>(false);
    const [hasMore, setHasMore] = useState<boolean>(false);
    const [lastCursor, setLastCursor] = useState<any>(null);
    const [error, setError] = useState<string>('');

    useEffect(() => {
        const loadUsers = async () => {
            setLoadingUsers(true);
            try {
                const res = await getAllUsers();
                const filtered = res.data
                    .filter((user: any) => user.role === 'user')
                    .sort((a: any, b: any) => (a.name || '').localeCompare(b.name || ''));
                setUsers(filtered);
                if (filtered.length > 0) {
                    setSelectedUserId(filtered[0].id);
                } else {
                    setSelectedUserId('');
                }
            } catch (err) {
                console.error('Failed to load users', err);
                setError('Unable to load users.');
            } finally {
                setLoadingUsers(false);
            }
        };
        loadUsers();
    }, []);

    useEffect(() => {
        if (!selectedUserId) return;
        loadLogs(true);
        loadDetections();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [selectedUserId, dateRange]);

    const loadLogs = async (reset = false) => {
        if (!selectedUserId) return;
        if (reset) {
            setLoadingLogs(true);
            setLogs([]);
            setLastCursor(null);
            setHasMore(false);
        } else {
            setLoadingMore(true);
        }

        try {
            const res = await getUserFoodLogs(selectedUserId, dateRange, 25, reset ? undefined : lastCursor);
            const mapped = res.data.map((item: any) => ({
                id: item.id,
                createdAt: item.createdAt,
                mealType: item.mealType || item.meal || item.food?.mealType || 'Unknown',
                foodName: item.foodName || item.food?.name || item.food?.foodName || 'Unknown',
                calories: Number(item.calories || item.food?.calories || 0),
                protein: Number(item.protein || item.food?.protein || 0),
                carbs: Number(item.carbs || item.food?.carbs || 0),
                fats: Number(item.fats || item.food?.fats || 0),
                status: item.status || 'pending',
            })) as FoodLogRecord[];
            setLogs(prev => (reset ? mapped : [...prev, ...mapped]));
            setLastCursor(res.lastVisible);
            setHasMore(res.hasMore);
        } catch (err) {
            console.error('Failed to load logs', err);
            setError('Unable to load tracking logs.');
        } finally {
            setLoadingLogs(false);
            setLoadingMore(false);
        }
    };

    const loadDetections = async () => {
        if (!selectedUserId) return;
        try {
            const res = await getUserDetections(selectedUserId, dateRange === 'today' ? 1 : dateRange === 'week' ? 7 : dateRange === 'month' ? 30 : undefined);
            setDetections(res);
        } catch (err) {
            setDetections([]);
        }
    };

    const selectedUser = users.find(user => user.id === selectedUserId);

    const summary = useMemo(() => {
        const totalCalories = logs.reduce((sum, log) => sum + log.calories, 0);
        const totalProtein = logs.reduce((sum, log) => sum + log.protein, 0);
        const totalCarbs = logs.reduce((sum, log) => sum + log.carbs, 0);
        const totalFats = logs.reduce((sum, log) => sum + log.fats, 0);
        const dates = Array.from(new Set(logs.map(log => log.createdAt.toISOString().split('T')[0])));
        const avgCalories = dates.length ? Math.round(totalCalories / dates.length) : 0;
        const counts = logs.reduce(
            (acc, log) => {
                const state = log.status?.toLowerCase() || 'pending';
                acc[state] = (acc[state] || 0) + 1;
                return acc;
            },
            { approved: 0, rejected: 0, pending: 0 } as Record<string, number>
        );
        const totalCount = counts.approved + counts.rejected + counts.pending;
        return {
            totalCalories,
            avgCalories,
            totalProtein,
            totalCarbs,
            totalFats,
            approvedPct: totalCount ? Math.round((counts.approved / totalCount) * 100) : 0,
            rejectedPct: totalCount ? Math.round((counts.rejected / totalCount) * 100) : 0,
            pendingPct: totalCount ? Math.round((counts.pending / totalCount) * 100) : 0,
        };
    }, [logs]);

    const chartData = useMemo(() => {
        const byDay = logs.reduce((acc: Record<string, number>, log) => {
            const day = log.createdAt.toISOString().split('T')[0];
            acc[day] = (acc[day] || 0) + log.calories;
            return acc;
        }, {});

        const dayLabels = Object.keys(byDay).sort();
        const barData: ChartData<'bar'> = {
            labels: dayLabels,
            datasets: [
                {
                    label: 'Calories',
                    data: dayLabels.map(day => byDay[day]),
                    backgroundColor: 'rgba(16, 185, 129, 0.85)',
                },
            ],
        };

        const doughnutData: ChartData<'doughnut'> = {
            labels: ['Protein', 'Carbs', 'Fats'],
            datasets: [
                {
                    data: [summary.totalProtein, summary.totalCarbs, summary.totalFats],
                    backgroundColor: ['rgba(16, 185, 129, 0.85)', 'rgba(59, 130, 246, 0.85)', 'rgba(245, 158, 11, 0.85)'],
                    borderWidth: 0,
                },
            ],
        };

        return { barData, doughnutData };
    }, [logs, summary.totalProtein, summary.totalCarbs, summary.totalFats]);

    const barOptions: ChartOptions<'bar'> = {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
            legend: { display: false },
            tooltip: { enabled: true },
        },
        scales: {
            x: { grid: { display: false } },
            y: { beginAtZero: true, grid: { color: 'rgba(15, 23, 42, 0.08)' } },
        },
    };

    const doughnutOptions: ChartOptions<'doughnut'> = {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
            legend: { position: 'bottom' as const, labels: { usePointStyle: true, padding: 16 } },
        },
        cutout: '70%',
    };

    const handleDownloadPdf = () => {
        if (!selectedUser) return;
        const reportUser = selectedUser.name || selectedUser.email || 'User';
        const filename = `tracking_report_${reportUser.replace(/\s+/g, '_').toLowerCase()}.pdf`;

        const doc = new jsPDF({ unit: 'pt', format: 'a4' });
        const left = 40;
        let y = 50;

        doc.setFontSize(18);
        doc.text('Tracking Report', left, y);
        y += 30;
        doc.setFontSize(11);
        doc.text(`User: ${reportUser}`, left, y);
        y += 18;
        doc.text(`Email: ${selectedUser.email || 'N/A'}`, left, y);
        y += 18;
        doc.text(`Height: ${selectedUser.height || 'N/A'} cm`, left, y);
        y += 18;
        doc.text(`Weight: ${selectedUser.weight || 'N/A'} kg`, left, y);
        y += 18;
        doc.text(`Goal: ${selectedUser.fitnessGoal || selectedUser.dailyCalorieGoal || 'N/A'}`, left, y);
        y += 28;

        doc.setFontSize(13);
        doc.text('Summary', left, y);
        y += 18;
        doc.setFontSize(11);
        doc.text(`Total Calories: ${summary.totalCalories} kcal`, left, y);
        y += 16;
        doc.text(`Avg Calories per day: ${summary.avgCalories} kcal`, left, y);
        y += 16;
        doc.text(`Protein: ${summary.totalProtein} g`, left, y);
        y += 16;
        doc.text(`Carbs: ${summary.totalCarbs} g`, left, y);
        y += 16;
        doc.text(`Fats: ${summary.totalFats} g`, left, y);
        y += 16;
        doc.text(`Approved: ${summary.approvedPct}%`, left, y);
        y += 16;
        doc.text(`Rejected: ${summary.rejectedPct}%`, left, y);
        y += 24;

        doc.setFontSize(13);
        doc.text('Food Logs', left, y);
        y += 18;
        doc.setFontSize(9);

        const tableHeaders = ['Date', 'Meal', 'Food', 'Calories', 'Protein', 'Carbs', 'Fats', 'Status'];
        const columnWidths = [65, 60, 145, 55, 55, 50, 50, 55];

        const printRow = (row: string[], rowY: number) => {
            let x = left;
            row.forEach((value, index) => {
                doc.text(`${value}`, x, rowY);
                x += columnWidths[index];
            });
        };

        printRow(tableHeaders, y);
        y += 16;
        doc.setDrawColor(220, 220, 220);
        doc.line(left, y - 8, 550, y - 8);

        logs.forEach((log, index) => {
            if (y > 740) {
                doc.addPage();
                y = 50;
            }
            printRow([
                log.createdAt.toISOString().split('T')[0],
                log.mealType,
                log.foodName,
                String(log.calories),
                String(log.protein),
                String(log.carbs),
                String(log.fats),
                log.status || 'pending',
            ], y);
            y += 14;
        });

        doc.save(filename);
    };

    return (
        <div className="space-y-6 animate-fade-in">
            <div>
                <h2 className="text-2xl font-black text-slate-800 tracking-tight">Tracking Reports</h2>
                <p className="text-slate-500 text-sm font-medium mt-1">Select a user to review their food logs, analytics, and export a PDF report.</p>
            </div>

            <Card className="p-6">
                <div className="grid gap-6 xl:grid-cols-[1.75fr,1fr]">
                    <div className="space-y-4">
                        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                            <div>
                                <p className="text-sm font-bold text-slate-900">User selection</p>
                                <p className="text-slate-500 text-sm">Pick a user to load their food logs and summary analytics.</p>
                            </div>
                        </div>
                        <select
                            value={selectedUserId}
                            onChange={(e) => setSelectedUserId(e.target.value)}
                            className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 pr-10 text-sm font-medium text-slate-700 focus:outline-none focus:ring-2 focus:ring-emerald-500 appearance-none -webkit-appearance-none -moz-appearance-none custom-select"
                            disabled={users.length === 0}
                        >
                            {users.length === 0 ? (
                                <option value="">No users available</option>
                            ) : (
                                <>
                                    <option value="" disabled>Select user</option>
                                    {users.map((user) => (
                                        <option key={user.id} value={user.id}>{user.name || user.email || 'Unnamed user'}</option>
                                    ))}
                                </>
                            )}
                        </select>

                        {users.length === 0 && (
                            <div className="p-4 rounded-3xl bg-amber-50 border border-amber-100 text-amber-700 text-sm font-medium italic">
                                No users available
                            </div>
                        )}

                        {selectedUser && (
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                <div className="rounded-3xl border border-slate-200 bg-slate-50 p-4">
                                    <p className="text-xs uppercase tracking-[0.2em] text-slate-500 font-bold">Name</p>
                                    <p className="text-lg font-black text-slate-900 mt-2">{selectedUser.name || 'N/A'}</p>
                                </div>
                                <div className="rounded-3xl border border-slate-200 bg-slate-50 p-4">
                                    <p className="text-xs uppercase tracking-[0.2em] text-slate-500 font-bold">Goal</p>
                                    <p className="text-lg font-black text-slate-900 mt-2">{selectedUser.fitnessGoal || selectedUser.dailyCalorieGoal || 'N/A'}</p>
                                </div>
                                <div className="rounded-3xl border border-slate-200 bg-slate-50 p-4">
                                    <p className="text-xs uppercase tracking-[0.2em] text-slate-500 font-bold">Height</p>
                                    <p className="text-lg font-black text-slate-900 mt-2">{selectedUser.height ? `${selectedUser.height} cm` : 'N/A'}</p>
                                </div>
                                <div className="rounded-3xl border border-slate-200 bg-slate-50 p-4">
                                    <p className="text-xs uppercase tracking-[0.2em] text-slate-500 font-bold">Weight</p>
                                    <p className="text-lg font-black text-slate-900 mt-2">{selectedUser.weight ? `${selectedUser.weight} kg` : 'N/A'}</p>
                                </div>
                            </div>
                        )}
                    </div>

                    <div className="space-y-4">
                        <div>
                            <p className="text-sm font-bold text-slate-900">Filter range</p>
                            <p className="text-slate-500 text-sm">Use a date range to narrow results before exporting.</p>
                        </div>
                        <div className="flex flex-wrap gap-3">
                            {DATE_OPTIONS.map((option) => (
                                <button
                                    key={option.value}
                                    onClick={() => setDateRange(option.value)}
                                    className={`rounded-full border px-4 py-2 text-sm font-semibold ${dateRange === option.value ? 'bg-emerald-600 text-white border-emerald-600' : 'bg-white text-slate-700 border-slate-200 hover:border-slate-300'}`}
                                >
                                    {option.label}
                                </button>
                            ))}
                        </div>
                        <div className="grid grid-cols-2 gap-3">
                            <Card className="p-4 bg-slate-50 border-slate-200">
                                <p className="text-xs uppercase tracking-[0.2em] text-slate-500 font-bold">Total Calories</p>
                                <p className="mt-3 text-3xl font-black text-slate-900">{summary.totalCalories}</p>
                            </Card>
                            <Card className="p-4 bg-slate-50 border-slate-200">
                                <p className="text-xs uppercase tracking-[0.2em] text-slate-500 font-bold">Avg / day</p>
                                <p className="mt-3 text-3xl font-black text-slate-900">{summary.avgCalories}</p>
                            </Card>
                            <Card className="p-4 bg-slate-50 border-slate-200">
                                <p className="text-xs uppercase tracking-[0.2em] text-slate-500 font-bold">Protein</p>
                                <p className="mt-3 text-3xl font-black text-slate-900">{summary.totalProtein}g</p>
                            </Card>
                            <Card className="p-4 bg-slate-50 border-slate-200">
                                <p className="text-xs uppercase tracking-[0.2em] text-slate-500 font-bold">Carbs</p>
                                <p className="mt-3 text-3xl font-black text-slate-900">{summary.totalCarbs}g</p>
                            </Card>
                            <Card className="p-4 bg-slate-50 border-slate-200">
                                <p className="text-xs uppercase tracking-[0.2em] text-slate-500 font-bold">Fats</p>
                                <p className="mt-3 text-3xl font-black text-slate-900">{summary.totalFats}g</p>
                            </Card>
                        </div>
                    </div>
                </div>
            </Card>

            <Card className="p-6">
                <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                        <p className="text-lg font-black text-slate-900">Food Log History</p>
                        <p className="text-slate-500 text-sm">Review the logs for the selected user.</p>
                    </div>
                    <Button onClick={handleDownloadPdf} disabled={!selectedUser || logs.length === 0} className="flex items-center gap-2">
                        <FiDownloadCloud className="w-4 h-4" /> Download PDF
                    </Button>
                </div>

                {error && <p className="mt-4 text-sm text-rose-600">{error}</p>}

                <div className="mt-6 overflow-x-auto">
                    <table className="min-w-full text-left text-sm">
                        <thead className="bg-slate-50 border-b border-slate-100 text-slate-500 uppercase text-[10px] tracking-[0.15em] font-black">
                            <tr>
                                <th className="px-4 py-3">Date</th>
                                <th className="px-4 py-3">Meal Type</th>
                                <th className="px-4 py-3">Food Name</th>
                                <th className="px-4 py-3">Calories</th>
                                <th className="px-4 py-3">Protein</th>
                                <th className="px-4 py-3">Carbs</th>
                                <th className="px-4 py-3">Fats</th>
                                <th className="px-4 py-3">Status</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                            {loadingLogs ? (
                                <tr>
                                    <td colSpan={8} className="py-12 text-center text-slate-500">
                                        <div className="inline-flex items-center gap-3">
                                            <span className="w-5 h-5 border-4 border-slate-200 border-t-emerald-500 rounded-full animate-spin"></span>
                                            Loading logs...
                                        </div>
                                    </td>
                                </tr>
                            ) : logs.length === 0 ? (
                                <tr>
                                    <td colSpan={8} className="py-12 text-center text-slate-500">No logs found for this user in the selected range.</td>
                                </tr>
                            ) : (
                                logs.map((log) => (
                                    <tr key={log.id} className="hover:bg-slate-50 transition-colors">
                                        <td className="px-4 py-3 font-medium text-slate-800">{log.createdAt.toISOString().split('T')[0]}</td>
                                        <td className="px-4 py-3">{log.mealType}</td>
                                        <td className="px-4 py-3">{log.foodName}</td>
                                        <td className="px-4 py-3">{log.calories}</td>
                                        <td className="px-4 py-3">{log.protein}</td>
                                        <td className="px-4 py-3">{log.carbs}</td>
                                        <td className="px-4 py-3">{log.fats}</td>
                                        <td className="px-4 py-3">
                                            <span className={`inline-flex items-center gap-2 rounded-full px-3 py-1 text-[11px] font-bold ${statusStyles[log.status?.toLowerCase() || 'pending']}`}>
                                                {log.status?.toLowerCase() || 'pending'}
                                            </span>
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>

                {hasMore && !loadingLogs && (
                    <div className="mt-4 text-right">
                        <Button onClick={() => loadLogs(false)} variant="secondary" disabled={loadingMore}>
                            {loadingMore ? 'Loading more...' : 'Load more logs'}
                        </Button>
                    </div>
                )}
            </Card>

            {/* <div className="grid gap-6 lg:grid-cols-2">
                <Card className="p-6">
                    <div className="flex items-center justify-between mb-4 gap-3">
                        <div>
                            <p className="text-sm font-bold uppercase tracking-[0.2em] text-slate-500 mb-1">Calories by day</p>
                            <p className="text-slate-500 text-sm">Simple daily intake trend.</p>
                        </div>
                        <FiTrendingUp className="w-6 h-6 text-emerald-500" />
                    </div>
                    <div className="h-72">
                        <Bar data={chartData.barData} options={barOptions} />
                    </div>
                </Card>

                <Card className="p-6">
                    <div className="flex items-center justify-between mb-4 gap-3">
                        <div>
                            <p className="text-sm font-bold uppercase tracking-[0.2em] text-slate-500 mb-1">Macro breakdown</p>
                            <p className="text-slate-500 text-sm">Protein, carbs, and fats distribution.</p>
                        </div>
                        <FiPieChart className="w-6 h-6 text-slate-600" />
                    </div>
                    <div className="h-72">
                        <Doughnut data={chartData.doughnutData} options={doughnutOptions} />
                    </div>
                </Card>
            </div>

            {detections.length > 0 && (
                <Card className="p-6">
                    <div className="flex items-center justify-between mb-4 gap-3">
                        <div>
                            <p className="text-sm font-bold uppercase tracking-[0.2em] text-slate-500 mb-1">Detection history</p>
                            <p className="text-slate-500 text-sm">Optional AI detection records for this user.</p>
                        </div>
                        <FiUsers className="w-6 h-6 text-slate-600" />
                    </div>
                    <div className="grid gap-4 md:grid-cols-2">
                        {detections.slice(0, 4).map((item: any) => (
                            <div key={item.id} className="rounded-3xl border border-slate-200 bg-slate-50 p-4">
                                <p className="text-xs uppercase tracking-[0.2em] text-slate-500 font-bold mb-2">{item.meal || item.foods?.[0]?.name || 'Detection'}</p>
                                <p className="text-sm font-medium text-slate-700">Confidence: {Math.round(item.foods?.[0]?.confidence * 100) / 100 || 0}%</p>
                                {item.imageUrl ? (
                                    <img src={item.imageUrl} alt="detection" className="mt-3 h-28 w-full rounded-3xl object-cover" />
                                ) : (
                                    <div className="mt-3 h-28 rounded-3xl bg-slate-100 flex items-center justify-center text-slate-400 text-sm">No image available</div>
                                )}
                            </div>
                        ))}
                    </div>
                </Card>
            )} */}
        </div>
    );
};

export default AdminLogMonitor;
