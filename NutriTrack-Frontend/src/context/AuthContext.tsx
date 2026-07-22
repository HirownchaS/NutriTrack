import React, { createContext, useState, useEffect, useContext } from 'react';
import { onAuthStateChanged } from 'firebase/auth';
import { auth } from '../firebase/config';
import { getUserRole, logoutUser } from '../firebase/auth';

// Define the shape of our User object
export interface User {
    uid: string;
    email: string | null;
    name: string;
    role: string;
    profileComplete: boolean;
}

// Define the shape of our Auth Context
interface AuthContextType {
    user: User | null;
    loading: boolean;
    login: (userData: User) => void;
    logout: () => void;
    completeProfile: () => void;
}

// Create the Auth Context
const AuthContext = createContext<AuthContextType | undefined>(undefined);

// eslint-disable-next-line react-refresh/only-export-components
export const useAuth = () => {
    const context = useContext(AuthContext);
    if (context === undefined) {
        throw new Error('useAuth must be used within an AuthProvider');
    }
    return context;
};

interface AuthProviderProps {
    children: React.ReactNode;
}

// AuthProvider - Manages authentication state globally using Firebase Auth.
// Listens to onAuthStateChanged and fetches role from Firestore.
export const AuthProvider: React.FC<AuthProviderProps> = ({ children }) => {
    const [user, setUser] = useState<User | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        // Listen for Firebase auth state changes
        const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
            if (firebaseUser) {
                try {
                    // Fetch role and profile info from Firestore
                    const roleData = await getUserRole(firebaseUser.uid);

                    if (roleData) {
                        setUser({
                            uid: firebaseUser.uid,
                            email: firebaseUser.email,
                            name: roleData.name,
                            role: roleData.role,
                            profileComplete: roleData.profileComplete,
                        });
                    } else {
                        // User exists in Auth but not in Firestore — edge case
                        setUser({
                            uid: firebaseUser.uid,
                            email: firebaseUser.email,
                            name: '',
                            role: 'user',
                            profileComplete: false,
                        });
                    }
                } catch (error) {
                    console.error('Error fetching user role:', error);
                    setUser(null);
                }
            } else {
                setUser(null);
            }
            setLoading(false);
        });

        return () => unsubscribe();
    }, []);

    // Used by Login/Register pages to immediately set user state
    // (before the onAuthStateChanged listener fires)
    const login = (userData: User) => {
        setUser(userData);
    };

    const completeProfile = () => {
        setUser(prev => {
            if (!prev) return prev;
            return { ...prev, profileComplete: true };
        });
    };

    const logout = async () => {
        setUser(null); // Clear state first to trigger cleanup of dependent effects
        try {
            await logoutUser();
        } catch (error) {
            console.error('Logout error:', error);
        }
    };

    return (
        <AuthContext.Provider value={{ user, login, logout, loading, completeProfile }}>
            {!loading && children}
        </AuthContext.Provider>
    );
};
