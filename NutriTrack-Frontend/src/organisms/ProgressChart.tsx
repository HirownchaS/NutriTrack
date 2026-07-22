import React, { useState, useEffect } from 'react';
import Card from '../atoms/Card';
import { getProgress } from '../services/analytics';

// Chart.js imports
import {
    Chart as ChartJS,
    CategoryScale,
    LinearScale,
    PointElement,
    LineElement,
    ArcElement,
    Title,
    Tooltip,
    Legend,
    Filler,
    ChartData,
    ChartOptions
} from 'chart.js';
import { Line, Doughnut } from 'react-chartjs-2';

// Register ChartJS components
ChartJS.register(
    CategoryScale, LinearScale, PointElement, LineElement,
    ArcElement, Title, Tooltip, Legend, Filler
);



interface ProgressData {
    labels: string[];
    caloriesData: number[];
    targetGoal: number;
    macroBreakdown: {
        protein: number;
        carbs: number;
        fats: number;
    };
}

type Period = 'daily' | 'weekly' | 'monthly';

const ProgressChart: React.FC = () => {
    const [progress, setProgress] = useState<ProgressData | null>(null);
    const [period, setPeriod] = useState<Period>('daily');

    useEffect(() => {
        const fetchProgress = async () => {
            try {
                const res = await getProgress(period);
                setProgress(res.data);
            } catch (err) {
                console.error('Failed to fetch progress', err);
            }
        };
        fetchProgress();
    }, [period]);

    if (!progress) return null;

    // --- Line Chart: Calorie trend ---
    const lineData: ChartData<'line'> = {
        labels: progress.labels,
        datasets: [
            {
                label: 'Calories Consumed',
                data: progress.caloriesData,
                borderColor: 'rgba(16, 185, 129, 1)',   // emerald-500
                backgroundColor: 'rgba(16, 185, 129, 0.1)',
                tension: 0.4,
                fill: true,
                pointBackgroundColor: 'rgba(16, 185, 129, 1)',
                pointRadius: 5,
                pointHoverRadius: 7,
            },
            {
                label: 'Calorie Goal',
                data: Array(progress.labels.length).fill(progress.targetGoal),
                borderColor: 'rgba(203, 213, 225, 1)',   // slate-300
                borderDash: [6, 4],
                pointRadius: 0,
                fill: false,
            },
        ],
    };

    const lineOptions: ChartOptions<'line'> = {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
            legend: { position: 'top', labels: { usePointStyle: true, padding: 16 } },
        },
        scales: {
            y: { beginAtZero: false, grid: { color: 'rgba(0,0,0,0.04)' } },
            x: { grid: { display: false } },
        },
    };

    // --- Donut Chart: Macronutrient breakdown ---
    const donutData: ChartData<'doughnut'> = {
        labels: ['Protein', 'Carbs', 'Fats'],
        datasets: [
            {
                data: [
                    progress.macroBreakdown.protein,
                    progress.macroBreakdown.carbs,
                    progress.macroBreakdown.fats,
                ],
                backgroundColor: [
                    'rgba(16, 185, 129, 0.85)',  // emerald
                    'rgba(59, 130, 246, 0.85)',  // blue
                    'rgba(245, 158, 11, 0.85)',  // amber
                ],
                borderWidth: 0,
            },
        ],
    };

    const donutOptions: ChartOptions<'doughnut'> = {
        responsive: true,
        maintainAspectRatio: false,
        cutout: '65%',
        plugins: {
            legend: { position: 'bottom' as const, labels: { usePointStyle: true, padding: 16 } },
        },
    };

    return (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6" role="region" aria-label="Progress tracking charts">
            {/* Line chart takes 2/3 */}
            <Card className="lg:col-span-2 p-6">
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between mb-4 gap-2">
                    <h3 className="text-sm font-bold text-slate-700 uppercase tracking-wider flex items-center gap-2">
                        <span className="w-2 h-2 rounded-full bg-emerald-500" aria-hidden="true"></span>
                        Calorie Trend
                    </h3>
                    <select
                        value={period}
                        onChange={(e) => setPeriod(e.target.value as Period)}
                        className="text-xs font-bold text-slate-600 bg-slate-50 border border-slate-200 rounded-lg px-3 py-1.5 pr-10 appearance-none -webkit-appearance-none -moz-appearance-none custom-select focus:outline-none focus:ring-2 focus:ring-emerald-500 cursor-pointer"
                    >
                        <option value="daily">Past 7 Days</option>
                        <option value="weekly">Past 4 Weeks</option>
                        <option value="monthly">Past 6 Months</option>
                    </select>
                </div>
                <div className="h-64">
                    <Line data={lineData} options={lineOptions} />
                </div>
            </Card>

            {/* Donut chart takes 1/3 */}
            <Card className="p-6">
                <h3 className="text-sm font-bold text-slate-700 uppercase tracking-wider mb-4 flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-blue-500" aria-hidden="true"></span>
                    Macro Breakdown
                </h3>
                <div className="h-64 flex items-center justify-center">
                    <Doughnut data={donutData} options={donutOptions} />
                </div>
            </Card>
        </div>
    );
};

export default ProgressChart;
