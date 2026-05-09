import React, { useState, useEffect } from 'react';
import Card from '../atoms/Card';
import Input from '../atoms/Input';
import Button from '../atoms/Button';
import { setGoals } from '../services/api';
import { auth, db } from '../firebase/config';
import { doc, getDoc } from 'firebase/firestore';

interface GoalState {
    calories: number;
    protein: number;
    carbs: number;
    fats: number;
}

interface StatusState {
    type: 'success' | 'error' | '';
    message: string;
}

interface GoalFormProps {
    onSuccess?: () => void;
}

const GoalForm: React.FC<GoalFormProps> = ({ onSuccess }) => {
    const [goals, setGoalsState] = useState<GoalState>({
        calories: 2000,
        protein: 150,
        carbs: 200,
        fats: 65,
    });
    const [status, setStatus] = useState<StatusState>({ type: '', message: '' });
    const [isLoading, setIsLoading] = useState<boolean>(false);

    useEffect(() => {
        const fetchGoals = async () => {
            try {
                if (auth.currentUser) {
                    const userDoc = await getDoc(doc(db, 'users', auth.currentUser.uid));
                    if (userDoc.exists()) {
                        const data = userDoc.data();
                        setGoalsState({
                            calories: data.dailyCalorieGoal || 2000,
                            protein: data.proteinGoal || 150,
                            carbs: data.carbsGoal || 200,
                            fats: data.fatsGoal || 65,
                        });
                    }
                }
            } catch (err) {
                console.error("Failed to load goals", err);
            }
        };
        fetchGoals();
    }, []);

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const { id, value } = e.target;
        setGoalsState(prev => ({ ...prev, [id]: Number(value) }));
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsLoading(true);
        setStatus({ type: '', message: '' });

        try {
            const res: any = await setGoals(goals);
            if (res.success) {
                setStatus({ type: 'success', message: 'Goals updated successfully!' });
                if (onSuccess) onSuccess();
            } else {
                throw new Error("Failed to update");
            }
        } catch (err: any) {
            setStatus({ type: 'error', message: 'Failed to update goals.' });
        } finally {
            setIsLoading(false);
            // Clear success message after 3 seconds
            setTimeout(() => setStatus({ type: '', message: '' }), 3000);
        }
    };

    return (
        <Card className="p-6 h-full flex flex-col">
            <div className="mb-6">
                <h3 className="text-lg font-bold text-slate-800">Personalized Goals</h3>
                <p className="text-sm text-slate-500">Set your daily nutritional targets.</p>
            </div>

            {status.message && (
                <div className={`mb-4 p-3 rounded-lg text-sm font-medium ${
                    status.type === 'success' 
                        ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' 
                        : 'bg-red-50 text-red-700 border border-red-200'
                }`}>
                    {status.message}
                </div>
            )}

            <form onSubmit={handleSubmit} className="flex-1 flex flex-col">
                <div className="space-y-4 flex-1">
                    <Input
                        id="calories"
                        label="Daily Calories (kcal)"
                        type="number"
                        value={goals.calories}
                        onChange={handleChange}
                        required
                    />
                    <div className="grid grid-cols-3 gap-3">
                        <Input
                            id="protein"
                            label="Protein (g)"
                            type="number"
                            value={goals.protein}
                            onChange={handleChange}
                            required
                        />
                        <Input
                            id="carbs"
                            label="Carbs (g)"
                            type="number"
                            value={goals.carbs}
                            onChange={handleChange}
                            required
                        />
                        <Input
                            id="fats"
                            label="Fats (g)"
                            type="number"
                            value={goals.fats}
                            onChange={handleChange}
                            required
                        />
                    </div>
                </div>

                <Button
                    type="submit"
                    variant="primary"
                    className="w-full mt-6"
                    disabled={isLoading}
                >
                    {isLoading ? 'Saving...' : 'Update Goals'}
                </Button>
            </form>
        </Card>
    );
};

export default GoalForm;

