import React from 'react';

interface CardProps {
    children: React.ReactNode;
    className?: string;
}

const Card: React.FC<CardProps> = ({ children, className = '' }) => {
    return (
        <div className={`bg-white rounded-xl shadow-md border-0 overflow-hidden ${className}`}>
            {children}
        </div>
    );
};

export default Card;
