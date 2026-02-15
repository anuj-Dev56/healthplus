import React, {useEffect} from 'react'
import AuthLayout from "../components/AuthLayout.jsx";
import {onAuthStateChanged, signOut} from "firebase/auth";
import {auth} from "../utils/firebase.js";

const Auth = ({type}) => {
    const [user, setUser] = React.useState(null);
    useEffect(() => {
        const unsub = onAuthStateChanged(auth, (u) => {
            setUser(u)
            console.log(u)
        })
        return () => unsub()
    }, [])

    if (user) {
        return (
            <div onClick={async () => {
                await signOut(auth)
            }} className={"flex justify-center items-center h-screen"}>
                <h1>You are already logged in</h1>
                <button className={"bg-white text-black p-2 ml-2 rounded-2xl"}>
                    SiginOut
                </button>
            </div>
        )
    }

    return (
        <div>
            <AuthLayout type={type}/>
        </div>
    )
}
export default Auth
