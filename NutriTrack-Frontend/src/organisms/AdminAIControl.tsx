import React, { useState, useEffect } from 'react';
import Card from '../atoms/Card';
import Button from '../atoms/Button';
import { useNotification } from '../context/NotificationContext';
import { getAIModelStatus, triggerRetrain } from '../services/admin';
import { FiCpu, FiPlay, FiRefreshCw, FiActivity, FiCheckCircle } from 'react-icons/fi';


interface ModelInfo {
    version: string;
    lastTrained: string;
    accuracy: number;
    precision: number;
    recall: number;
}

const AdminAIControl: React.FC = () => {
    const [modelInfo, setModelInfo] = useState<ModelInfo | null>(null);
    const [loading, setLoading] = useState<boolean>(true);
    const [retraining, setRetraining] = useState<boolean>(false);
    const { success, error } = useNotification();

    useEffect(() => {
        fetchModelStatus();
    }, []);

    const fetchModelStatus = async () => {
        try {
            const res = await getAIModelStatus();
            setModelInfo(res.data);
        } catch (err) {
            console.error("Failed to fetch model status", err);
        } finally {
            setLoading(false);
        }
    };

    const handleRetrain = async () => {
        setRetraining(true);
        try {
            await triggerRetrain();
            success('Model retraining has been initiated.');
            fetchModelStatus();
        } catch (err) {
            error('Failed to start retraining');
        } finally {
            setRetraining(false);
        }
    };

    if (loading) {
        return (
            <div className="flex justify-center items-center h-64">
                <div className="w-10 h-10 border-4 border-emerald-200 border-t-emerald-600 rounded-full animate-spin"></div>
            </div>
        );
    }

    return (
        <div className="space-y-8 animate-fade-in">
            <div className="flex justify-between items-end">
                <div>
                    <h2 className="text-2xl font-black text-slate-800 tracking-tight">AI Model Control</h2>
                    <p className="text-slate-500 text-sm font-medium mt-1">Monitor YOLOv8 performance and trigger model updates.</p>
                </div>
                <div className="flex bg-emerald-50 px-4 py-2 rounded-xl items-center gap-2 border border-emerald-100">
                    <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
                    <span className="text-emerald-700 font-black text-xs uppercase tracking-wider">System: Stable</span>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <Card className="lg:col-span-2 p-8 border-emerald-100 relative overflow-hidden">
                    <div className="absolute top-0 right-0 p-8 opacity-10">
                        <FiCpu size={120} />
                    </div>
                    <div className="relative z-10">
                        <div className="flex items-center gap-4 mb-8">
                            <div className="w-16 h-16 bg-emerald-600 rounded-2xl flex items-center justify-center text-white text-3xl">
                                <FiActivity />
                            </div>
                            <div>
                                <h3 className="text-2xl font-black text-slate-800">{modelInfo?.version}</h3>
                                <p className="text-slate-400 font-medium">Last trained: {modelInfo?.lastTrained}</p>
                            </div>
                        </div>

                        <div className="grid grid-cols-3 gap-4 mb-8">
                            {[
                                { label: 'Accuracy', value: `${((modelInfo?.accuracy || 0) * 100).toFixed(1)}%`, color: 'text-emerald-600' },
                                { label: 'Precision', value: `${((modelInfo?.precision || 0) * 100).toFixed(1)}%`, color: 'text-blue-600' },
                                { label: 'Recall', value: `${((modelInfo?.recall || 0) * 100).toFixed(1)}%`, color: 'text-purple-600' },
                            ].map((stat, idx) => (
                                <div key={idx} className="bg-slate-50 p-4 rounded-2xl border border-slate-100">
                                    <p className="text-[10px] text-slate-400 uppercase font-black tracking-widest mb-1">{stat.label}</p>
                                    <p className={`text-2xl font-black ${stat.color}`}>{stat.value}</p>
                                </div>
                            ))}
                        </div>

                        <div className="flex gap-4">
                            <Button
                                onClick={handleRetrain}
                                disabled={retraining}
                                variant="primary"
                                className="flex-1 bg-slate-800 hover:bg-slate-900 flex items-center justify-center gap-2 py-4"
                            >
                                {retraining ? <FiRefreshCw className="animate-spin" /> : <FiPlay />}
                                Retrain Model Now
                            </Button>
                            <Button variant="secondary" className="flex-1 border-slate-200 py-4">
                                Download Latest .weights
                            </Button>
                        </div>
                    </div>
                </Card>

                <div className="space-y-6">
                    <Card className="p-6 border-slate-200">
                        <h4 className="font-black text-slate-800 mb-4 flex items-center gap-2">
                            <FiCheckCircle className="text-emerald-500" /> Training Status
                        </h4>
                        <div className="p-8 text-center bg-slate-50 rounded-xl border border-dashed border-slate-200">
                            <p className="text-slate-400 text-xs italic">Detailed training metrics are currently unavailable.</p>
                        </div>
                    </Card>

                    <Card className="p-6 bg-gradient-to-br from-indigo-600 to-purple-700 text-white border-0">
                        <h4 className="font-black mb-2 uppercase text-[10px] tracking-widest opacity-80">Dataset Health</h4>
                        <p className="text-xs text-white/70 leading-relaxed italic">
                            System is monitoring dataset distribution. Health report will appear here.
                        </p>
                    </Card>
                </div>
            </div>
        </div>
    );
};

export default AdminAIControl;
