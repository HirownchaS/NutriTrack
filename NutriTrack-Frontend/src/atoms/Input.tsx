import React from 'react';

interface InputProps {
    label?: string;
    type?: string;
    value: string | number;
    onChange: (event: React.ChangeEvent<HTMLInputElement>) => void;
    placeholder?: string;
    required?: boolean;
    id?: string;
    className?: string;
    disabled?: boolean;
}

const Input: React.FC<InputProps> = ({
    label,
    type = 'text',
    value,
    onChange,
    placeholder,
    required = false,
    id,
    className = ''
}) => {
    return (
        <div className={`flex flex-col mb-4 ${className}`}>
            {label && (
                <label htmlFor={id} className="mb-2 text-sm font-semibold text-slate-700">
                    {label} {required && <span className="text-red-500">*</span>}
                </label>
            )}
            <input
                id={id}
                type={type}
                value={value}
                onChange={onChange}
                placeholder={placeholder}
                required={required}
                className="px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200"
            />
        </div>
    );
};

export default Input;
