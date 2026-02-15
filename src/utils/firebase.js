// Import the functions you need from the SDKs you need
import {initializeApp} from "firebase/app";
import {
    createUserWithEmailAndPassword,
    getAuth,
    GoogleAuthProvider,
    signInWithEmailAndPassword,
    signInWithPopup,
    signInWithRedirect,
    getRedirectResult,
    getAdditionalUserInfo
} from "firebase/auth";
import {
    getFirestore,
    doc,
    getDoc,
    setDoc,
    serverTimestamp,
    collection,
    addDoc,
    updateDoc
} from "firebase/firestore";
import toast from "react-hot-toast";

// TODO: Add SDKs for Firebase products that you want to use
// https://firebase.google.com/docs/web/setup#available-libraries

// Your web app's Firebase configuration
const firebaseConfig = {
    apiKey: "AIzaSyA0PgqlDqsiKTg0An_XV_zKzAAoidfNNlA",
    authDomain: "heathplus-5c960.firebaseapp.com",
    projectId: "heathplus-5c960",
    storageBucket: "heathplus-5c960.firebasestorage.app",
    messagingSenderId: "960066622145",
    appId: "1:960066622145:web:cb777ee63e557abfd73a40"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

// Debug: print project id to help confirm which Firebase project the client is using
console.debug('Firebase projectId:', firebaseConfig.projectId);

// Helper: create a Firestore user document if it doesn't already exist
const createUserDocumentIfNotExists = async (user, additionalData = {}) => {
    if (!user || !user.uid) return null;
    try {
        const userRef = doc(db, 'users', user.uid);
        const snap = await getDoc(userRef);
        if (!snap.exists()) {
            const data = {
                uid: user.uid,
                email: user.email || null,
                displayName: user.displayName || null,
                photoURL: user.photoURL || null,
                provider: additionalData.provider || null,
                createdAt: serverTimestamp(),
                ...additionalData
            };
            await setDoc(userRef, data);
            return data;
        }
        return snap.data();
    } catch (err) {
        console.error('createUserDocumentIfNotExists error', err);
        return null;
    }
};

// New helper: get a user's Firestore document data by uid
const getUserDocument = async (uid) => {
    if (!uid) return null;
    try {
        const userRef = doc(db, 'users', uid);
        const snap = await getDoc(userRef);
        if (!snap.exists()) return null;
        return snap.data();
    } catch (err) {
        console.error('getUserDocument error', err);
        return null;
    }
};

// New helper: set/merge the user's "type" field in Firestore (e.g., 'admin' or 'client')
const setUserType = async (uid, type) => {
    if (!uid) return false;
    try {
        const userRef = doc(db, 'users', uid);
        await setDoc(userRef, { type }, { merge: true });
        return true;
    } catch (err) {
        console.error('setUserType error', err);
        return false;
    }
};

// New helper: send a report document to the 'reports' collection
const sendReport = async (uid, { type, description = '', location = null }) => {
    if (!uid) {
        toast.error('You must be signed in to send reports');
        return { ok: false, error: 'Not authenticated' };
    }
    try {
        const payload = {
            uid,
            type: (type || '').toLowerCase(),
            description: description || null,
            location: location || null,
            status: 'new',
            createdAt: serverTimestamp(),
            createdAtClient: Date.now()
        };
        console.debug('sendReport -> projectId:', firebaseConfig.projectId, 'payload:', payload);
        const col = collection(db, 'reports');
        const docRef = await addDoc(col, payload);
        // read back the created document to confirm and return data (createdAt may be unresolved immediately)
        const snap = await getDoc(docRef);
        const data = snap.exists() ? snap.data() : null;
        console.debug('sendReport created', { id: docRef.id, data });
        toast.success('Report sent to admins');
        return { ok: true, id: docRef.id, payload, data };
    } catch (err) {
        console.error('sendReport error', err);
        toast.error('Failed to send report');
        return { ok: false, error: String(err) };
    }
};

// New helper: update a report's status (e.g., 'cleaned' or 'resolved')
const setReportStatus = async (reportId, status) => {
    if (!reportId) return { ok: false, error: 'Missing reportId' };
    try {
        const ref = doc(db, 'reports', reportId);
        await updateDoc(ref, { status });
        return { ok: true };
    } catch (err) {
        console.error('setReportStatus error', err);
        return { ok: false, error: String(err) };
    }
};

const signup = async (email, password) => {
    try {
        const userCredential =
            await createUserWithEmailAndPassword(auth, email, password);

        // Ensure a Firestore user doc exists for this new user
        await createUserDocumentIfNotExists(userCredential.user, { method: 'email' });

        return {
            user: userCredential.user,
        };
    } catch (error) {
      toast.error("Firebase Signin failed", error.message || error);
        return {
            user: false,
            error: error.message || String(error)
        }
    }
};

const getReportByUser = async (uid) => {
    if (!uid) return [];
    try {
        const q = query(collection(db, 'reports'), where('uid', '==', uid));
        const snap = await getDocs(q);
        const reports = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        return reports;
    } catch (e) {
        toast(e.message)
    }
}

const login = async (email, password) => {
    try {
        const userCredential =
            await signInWithEmailAndPassword(auth, email, password);

        // Ensure the Firestore user doc exists (in case it wasn't created during signup)
        await createUserDocumentIfNotExists(userCredential.user, { method: 'email' });

        return {
            user: userCredential.user,
        };
    } catch (error) {
        toast.error(error.message.replace("Firebase: Error", "") || error);
        return {
            user: false,
            error: error.message || String(error)
        };
    }
};

const provider = new GoogleAuthProvider();

const googleLogin = async () => {
    try {
        // Try popup first (works in normal browser)
        const result = await signInWithPopup(auth, provider);
        const credential = GoogleAuthProvider.credentialFromResult(result);
        const token = credential?.accessToken;
        const userObj = result.user;

        // Determine if this is a new user via additionalUserInfo
        const info = getAdditionalUserInfo(result);
        const providerId = info?.providerId || 'google';

        // Create the Firestore user document for new users or ensure it exists
        await createUserDocumentIfNotExists(userObj, { method: 'google', provider: providerId });

        return {
            user: userObj,
            token
        };
    } catch (e) {
        // Popup can fail in some environments (mobile in-app browsers, blocked popups).
        // Fallback to redirect-based flow which works in those cases.
        console.warn('signInWithPopup failed, falling back to redirect:', e?.message || e);
        try {
            await signInWithRedirect(auth, provider);
            // inform caller that a redirect was initiated; the app should call handleRedirectResult on load
            return { user: false, redirect: true };
        } catch (err) {
            toast.error(err.message || err);
            return { user: false, error: err.message || String(err) };
        }
    }
};

// Helper: handle redirect result (call once on app startup to complete redirect sign-in)
const handleRedirectResult = async () => {
    try {
        const result = await getRedirectResult(auth);
        if (!result) return { user: false };
        const credential = GoogleAuthProvider.credentialFromResult(result);
        const token = credential?.accessToken;
        const userObj = result.user;
        const info = getAdditionalUserInfo(result);
        const providerId = info?.providerId || 'google';
        await createUserDocumentIfNotExists(userObj, { method: 'google', provider: providerId });
        return { user: userObj, token };
    } catch (e) {
        // getRedirectResult throws if there was no redirect
        console.debug('handleRedirectResult: no redirect result or error', e?.message || e);
        return { user: false, error: e?.message || String(e) };
    }
};

const user = {
    signup,
    login,
    googleLogin,
};

export {app, auth, user, getUserDocument, setUserType, sendReport, setReportStatus, db, getReportByUser, handleRedirectResult}
