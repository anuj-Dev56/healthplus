import React from 'react'
import {useNavigate} from "react-router-dom";
import {onAuthStateChanged} from "firebase/auth";
import {auth} from "../utils/firebase.js";

const Home = () => {
    const navigate = useNavigate();
    const [user, setUser] = React.useState(null);
    const [isLoading, setIsLoading] = React.useState(false);

    React.useEffect(() => {
        setIsLoading(true);
        const unsub = onAuthStateChanged(auth, (u) => {
            setUser(u);
            setIsLoading(false);
        });

        return () => unsub();
    }, []);

    // If authenticated, redirect to dashboard
    React.useEffect(() => {
        if (user) navigate('/dashboard');
    }, [user, navigate]);

    if (isLoading) {
        return (
            <div className={"min-h-screen flex items-center justify-center"}>
                <div>Loading...</div>
            </div>
        )
    }

    // Simple, not-too-modern homepage for unauthenticated visitors
    return (
        <div className={"min-h-screen bg-black text-white"}>

            <main className={"max-w-4xl mx-auto px-4 py-12"}>
                <section className={"mb-12 text-center"}>
                    <h1 className={"text-3xl font-extrabold mb-4"}>Welcome to HealthPlus</h1>
                    <p className={"text-gray-100 mb-6"}>Simple health management tools for clinics and patients. Track appointments, manage profiles, and stay connected.</p>
                    <div className={"flex flex-col sm:flex-row items-center justify-center gap-3"}>
                        <a href="/auth/signin" className={"w-full sm:w-auto text-center px-4 py-2 bg-blue-600 text-white rounded"}>Create an account</a>
                        <a href="/auth/login" className={"w-full sm:w-auto text-center px-4 py-2 border rounded"}>Sign in</a>
                    </div>
                </section>

                <section id="features" className={"mb-12"}>
                    <h2 className={"text-2xl font-semibold mb-4"}>Features</h2>
                    <ul className={"space-y-3 text-gray-100"}>
                        <li>- Simple appointment scheduling</li>
                        <li>- Secure user profiles</li>
                        <li>- Role-based access (admin / client)</li>
                        <li>- Google Sign-In support</li>
                    </ul>
                </section>

                <section id="about" className={"mb-12"}>
                    <h2 className={"text-2xl font-semibold mb-4"}>About HealthPlus</h2>
                    <p className={"text-gray-100"}>HealthPlus is a lightweight demo app built to showcase basic authentication and user role handling using Firebase. It aims to be clear and easy to extend.</p>
                </section>
            </main>

            <footer className={"border-t bg-black py-6 mt-8"}>
                <div className={"max-w-4xl mx-auto px-4 text-sm text-gray-100 text-center"}>
                    © {new Date().getFullYear()} HealthPlus — Built with Firebase & React
                </div>
            </footer>
        </div>
    )
}
export default Home
