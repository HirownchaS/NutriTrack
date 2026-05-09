import React from 'react';

interface BadgeProps {
    children: React.ReactNode;
    color?: 'green' | 'blue' | 'orange' | 'gray' | 'red';
    className?: string;
}

const Badge: React.FC<BadgeProps> = ({ children, color = 'green', className = '' }) => {
    const colorMap: Record<string, string> = {
        green: 'bg-emerald-100 text-emerald-800 border-emerald-200',
        blue: 'bg-blue-100 text-blue-800 border-blue-200',
        orange: 'bg-orange-100 text-orange-800 border-orange-200',
        gray: 'bg-slate-100 text-slate-800 border-slate-200',
        red: 'bg-red-100 text-red-800 border-red-200',
    };

    const badgeColor = colorMap[color] || colorMap.gray;

    return (
        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold border ${badgeColor} ${className}`}>
            {children}
        </span>
    );
};

export default Badge;
