import React, { useState } from 'react';
import { FiEye, FiEyeOff } from 'react-icons/fi';

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
    showPasswordToggle?: boolean;
}

const Input: React.FC<InputProps> = ({
    label,
    type = 'text',
    value,
    onChange,
    placeholder,
    required = false,
    id,
    className = '',
    disabled = false,
    showPasswordToggle = false,
}) => {
    const [showPassword, setShowPassword] = useState(false);
    const inputType = type === 'password' && showPasswordToggle ? (showPassword ? 'text' : 'password') : type;

    return (
        <div className={`flex flex-col mb-4 ${className}`}>
            {label && (
                <label htmlFor={id} className="mb-2 text-sm font-semibold text-slate-700">
                    {label} {required && <span className="text-red-500">*</span>}
                </label>
            )}
            <div className="relative">
                <input
                    id={id}
                    type={inputType}
                    value={value}
                    onChange={onChange}
                    placeholder={placeholder}
                    required={required}
                    disabled={disabled}
                    className="w-full px-4 py-2 pr-11 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200"
                />
                {showPasswordToggle && type === 'password' && (
                    <button
                        type="button"
                        onClick={() => setShowPassword((prev) => !prev)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-700 transition-colors"
                        aria-label={showPassword ? 'Hide password' : 'Show password'}
                    >
                        {showPassword ? <FiEyeOff className="w-5 h-5" /> : <FiEye className="w-5 h-5" />}
                    </button>
                )}
            </div>
        </div>
    );
};

export default Input;
