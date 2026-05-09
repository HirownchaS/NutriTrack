import {
    createUserWithEmailAndPassword,
    signInWithEmailAndPassword,
    signOut,
    sendPasswordResetEmail,
    verifyPasswordResetCode,
    confirmPasswordReset,
} from 'firebase/auth';
import {
    doc,
    setDoc,
    getDoc,
    updateDoc,
    serverTimestamp,
    collection,
    getDocs,
    deleteDoc,
    query,
    where,
    orderBy,
    limit,
    addDoc,
    onSnapshot,
} from 'firebase/firestore';
import { auth, secondaryAuth, db } from './config';

// ---- Types ----

export interface RegisterData {
    name: string;
    email: string;
    password: string;
}

export interface NutritionistData {
    name: string;
    email: string;
    password: string;
    specialization: string;
    experience: string;
}

export interface UserRole {
    role: string;
    profileComplete: boolean;
    name: string;
    email: string;
    collection: 'users' | 'nutritionists';
}

// ---- Auth Functions ----

/**
 * Register a new user with Firebase Auth + create Firestore doc.
 * Only users register through the public form. Role is always "user".
 */
export const registerUser = async ({ name, email, password }: RegisterData) => {
    const credential = await createUserWithEmailAndPassword(auth, email, password);
    const uid = credential.user.uid;

    // Create user document in Firestore - MUST use user.uid as document ID
    const userDocRef = doc(db, 'users', uid);

    await setDoc(userDocRef, {
        name,
        email,
        role: 'user',
        profileComplete: false,
        createdAt: serverTimestamp(),
    });



    return { uid, email, role: 'user', profileComplete: false };
};


//  Login user with Firebase Auth.

export const loginUser = async (email: string, password: string) => {
    const credential = await signInWithEmailAndPassword(auth, email, password);
    return credential.user;
};

/**
 * Sign out from Firebase.
 */
export const logoutUser = async () => {
    await signOut(auth);
};

/**
 * Detect user role by checking Firestore collections.
 * returns role info or null if not found.
 */
export const getUserRole = async (uid: string): Promise<UserRole | null> => {


    // Check users collection
    const userDocRef = doc(db, 'users', uid);
    const userDoc = await getDoc(userDocRef);

    if (userDoc.exists()) {

        const data = userDoc.data();
        return {
            role: data.role || 'user',
            profileComplete: data.profileComplete ?? true,
            name: data.name || '',
            email: data.email || '',
            collection: 'users',
        };
    }

    // Fallback: Check nutritionists collection (for legacy accounts)
    const nutriDocRef = doc(db, 'nutritionists', uid);
    const nutriDoc = await getDoc(nutriDocRef);

    if (nutriDoc.exists()) {
        // console.log(`[getUserRole] Found legacy user in 'nutritionists'. Document ID: ${nutriDoc.id}`);
        const data = nutriDoc.data();
        return {
            role: 'nutritionist',
            profileComplete: true,
            name: data.name || '',
            email: data.email || '',
            collection: 'nutritionists',
        };
    }

    console.error(`[getUserRole] Account data not found anywhere for UID: ${uid}`);
    return null;
};

/**
 * Fetch the full user profile document from Firestore.
 */
export const getUserProfile = async (uid: string) => {
    const userDocRef = doc(db, 'users', uid);
    const userDoc = await getDoc(userDocRef);
    if (userDoc.exists()) {
        return userDoc.data();
    }
    return null;
};

/**
 * Save / update profile data in Firestore for a user.
 * Marks profileComplete = true.
 */
export const saveProfile = async (uid: string, profileData: Record<string, unknown>) => {
    await updateDoc(doc(db, 'users', uid), {
        ...profileData,
        profileComplete: true,
    });
};

/**
 * Admin creates a nutritionist account.
 * Uses the secondary auth instance so the admin session is not disrupted.
 * Saves directly to the 'users' collection.
 */
export const createNutritionistAccount = async (
    data: NutritionistData,
    adminUid: string
) => {
    // Create auth account via secondary instance
    const credential = await createUserWithEmailAndPassword(
        secondaryAuth,
        data.email,
        data.password
    );
    const uid = credential.user.uid;

    // Sign out from secondary immediately (cleanup)
    await signOut(secondaryAuth);

    // Save nutritionist data in 'users' collection
    await setDoc(doc(db, 'users', uid), {
        name: data.name,
        email: data.email,
        role: 'nutritionist',
        specialization: data.specialization,
        experience: data.experience,
        profileComplete: true, // Nutritionists bypass setup
        createdBy: adminUid,
        createdAt: serverTimestamp(),
    });

    return { uid, email: data.email };
};

/**
 * Fetch all users from Firestore 'users' collection.
 */
export const getUsers = async () => {
    try {
        const user = auth.currentUser;
        if (!user) throw new Error("Not authenticated");

        const usersCol = collection(db, 'users');
        const userSnapshot = await getDocs(query(usersCol));
        return userSnapshot.docs.map(doc => ({
            uid: doc.id,
            ...doc.data()
        }));
    } catch (error) {
        console.error("Error fetching users:", error);
        throw error;
    }
};

/**
 * Delete a user document from Firestore.
 */
export const deleteUserAccount = async (uid: string) => {
    await deleteDoc(doc(db, 'users', uid));
};

/**
 * Update a user's role in Firestore.
 */
export const updateUserRole = async (uid: string, role: string) => {
    await updateDoc(doc(db, 'users', uid), { role });
};

/**
 * Update arbitrary fields on a user document.
 */
export const updateUserDoc = async (uid: string, data: Record<string, unknown>) => {
    await updateDoc(doc(db, 'users', uid), data);
};

/**
 * Fetch all nutritionists from Firestore 'users' collection.
 */
export const getNutritionists = async () => {
    try {
        const user = auth.currentUser;
        if (!user) throw new Error("Not authenticated");

        const usersCol = collection(db, 'users');
        const q = query(usersCol, where('role', '==', 'nutritionist'));
        const snapshot = await getDocs(q);
        return snapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data()
        }));
    } catch (error) {
        console.error("Error fetching nutritionists:", error);
        throw error;
    }
};

/**
 * Send a nutritionist request.
 */
export const sendNutritionistRequest = async (userId: string, nutritionistId: string) => {
    try {
        const user = auth.currentUser;
        if (!user) throw new Error("Not authenticated");

        const requestsCol = collection(db, 'nutritionist_requests');
        
        // Check if request already exists
        const q = query(
            requestsCol,
            where('userId', '==', userId),
            where('nutritionistId', '==', nutritionistId)
        );
        const snapshot = await getDocs(q);
        
        if (!snapshot.empty) {
            throw new Error('duplicate-request');
        }

        // Fetch user data to duplicate into the request for nutritionist visibility
        const { getDoc, doc } = await import('firebase/firestore');
        const userDoc = await getDoc(doc(db, 'users', userId));
        const userData = userDoc.exists() ? userDoc.data() : {};

        await addDoc(requestsCol, {
            userId,
            nutritionistId,
            name: userData.name || 'User',
            email: userData.email || '',
            age: userData.age || null,
            weight: userData.weight || null,
            healthCondition: userData.healthCondition || '',
            fitnessGoal: userData.fitnessGoal || '',
            status: 'pending',
            createdAt: serverTimestamp(),
        });

        // Add real-time notification for the nutritionist
        const { addNotification } = await import('../services/firestore');
        const userName = userData.name || 'User';

        await addNotification({
            receiverId: nutritionistId,
            senderId: userId,
            senderName: userName,
            message: `You have a new request from ${userName}`,
            type: 'request'
        });
    } catch (error) {
        console.error("Error sending nutritionist request:", error);
        throw error;
    }
};

/**
 * Listen to all nutritionist requests for a user in real-time.
 */
export const listenToUserNutritionistRequests = (userId: string, callback: (requests: any[]) => void) => {
    if (!userId) return () => {};
    
    const requestsCol = collection(db, 'nutritionist_requests');
    const q = query(
        requestsCol, 
        where('userId', '==', userId)
    );
    
    return onSnapshot(q, (snapshot: any) => {
        const requests = snapshot.docs.map((doc: any) => {
            const data = doc.data();
            return {
                id: doc.id,
                status: data.status,
                nutritionistId: data.nutritionistId,
                createdAt: data.createdAt
            };
        });
        callback(requests);
    }, (error: any) => {
        console.error("listenToUserNutritionistRequests error:", error);
    });
};

/**
 * Get the current nutritionist request for a user.
 */
export const getUserNutritionistRequest = async (userId: string) => {
    const requestsCol = collection(db, 'nutritionist_requests');
    const q = query(
        requestsCol, 
        where('userId', '==', userId), 
        orderBy('createdAt', 'desc'), 
        limit(1)
    );
    const snapshot = await getDocs(q);
    if (snapshot.empty) return null;
    const data = snapshot.docs[0].data();
    return {
        id: snapshot.docs[0].id,
        status: data.status,
        nutritionistId: data.nutritionistId
    };
};

/**
 * Get ALL nutritionist requests for a user.
 */
export const getUserAllNutritionistRequests = async (userId: string) => {
    try {
        const user = auth.currentUser;
        if (!user) throw new Error("Not authenticated");

        const requestsCol = collection(db, 'nutritionist_requests');
        const q = query(
            requestsCol, 
            where('userId', '==', userId)
        );
        const snapshot = await getDocs(q);
        return snapshot.docs.map(doc => {
            const data = doc.data();
            return {
                id: doc.id,
                status: data.status,
                nutritionistId: data.nutritionistId,
                createdAt: data.createdAt
            };
        });
    } catch (error) {
        console.error("Error fetching all nutritionist requests:", error);
        throw error;
    }
};

/**
 * Send a password reset email via Firebase Auth.
 * Throws an error with a user-friendly message if the email is not registered.
 */
export const sendPasswordReset = async (email: string): Promise<void> => {
    try {
        await sendPasswordResetEmail(auth, email);
    } catch (err: any) {
        if (
            err.code === 'auth/user-not-found' ||
            err.code === 'auth/invalid-email'
        ) {
            throw new Error('No account found with this email address.');
        }
        throw new Error('Failed to send reset email. Please try again.');
    }
};

/**
 * Verify the password reset code (oobCode) from the URL.
 * Returns the email associated with the code if valid.
 */
export const verifyResetCode = async (code: string): Promise<string> => {
    try {
        return await verifyPasswordResetCode(auth, code);
    } catch (err: any) {
        console.error("Error verifying reset code:", err);
        throw new Error('The reset link is invalid or has expired.');
    }
};

/**
 * Confirm the password reset with the new password and code.
 */
export const resetPassword = async (code: string, newPassword: string): Promise<void> => {
    try {
        await confirmPasswordReset(auth, code, newPassword);
    } catch (err: any) {
        console.error("Error confirming password reset:", err);
        if (err.code === 'auth/weak-password') {
            throw new Error('Password is too weak. Use at least 6 characters.');
        }
        throw new Error('Failed to reset password. The link may have expired.');
    }
};
