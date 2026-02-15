import React, {useEffect, useState} from 'react'
import {motion} from "motion/react"
import {FcGoogle} from "react-icons/fc";
import {user, getUserDocument, setUserType, auth} from "../utils/firebase.js"
import {onAuthStateChanged} from "firebase/auth"

const AuthLayout = ({type = 'login'}) => {
    const [currentType, setCurrentType] = useState(type?.toLowerCase() === 'signin' ? 'signin' : 'login')
    const [isLoading, setIsLoading] = useState(false)
    const [message, setMessage] = useState(null)
    const [errors, setErrors] = useState({})

    // form state
    const [email, setEmail] = useState('')
    const [password, setPassword] = useState('')
    const [confirmPassword, setConfirmPassword] = useState('')

    // new: track firebase user and whether we need to ask for type
    const [fbUser, setFbUser] = useState(null)
    const [needsType, setNeedsType] = useState(false)
    const [settingType, setSettingType] = useState(false)

    useEffect(() => {
        // keep local state in sync if parent changes the `type` prop
        if (type) {
            setCurrentType(type?.toLowerCase() === 'signin' ? 'signin' : 'login')
            setMessage(null)
            setErrors({})
        }
    }, [type])

    // Listen for firebase auth state changes so we can check the user doc
    useEffect(() => {
        const unsub = onAuthStateChanged(auth, async (u) => {
            setFbUser(u)
            if (u) {
                const doc = await getUserDocument(u.uid)
                // if user doc exists but has no `type` field, ask the user to pick one
                if (doc && !doc.type) {
                    setNeedsType(true)
                } else {
                    setNeedsType(false)
                }
            } else {
                setNeedsType(false)
            }
        })
        return () => unsub()
    }, [])

    const validate = () => {
        const e = {}
        if (!email) e.email = 'Email is required'
        else if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) e.email = 'Enter a valid email'

        if (!password) e.password = 'Password is required'
        else if (password.length < 6) e.password = 'Password must be at least 6 characters'

        if (currentType === 'signin') {
            if (!confirmPassword) e.confirmPassword = 'Please confirm your password'
            else if (password !== confirmPassword) e.confirmPassword = 'Passwords do not match'
        }

        setErrors(e)
        return Object.keys(e).length === 0
    }

    const afterAuthCheckType = async (u) => {
        // helper to check firestore doc after login/signup and set needsType
        if (!u) return
        const doc = await getUserDocument(u.uid)
        if (doc && !doc.type) setNeedsType(true)
        else setNeedsType(false)
    }

    const handleSubmit = async (ev) => {
        ev.preventDefault()
        setMessage(null)

        if (!validate()) return

        setIsLoading(true)
        // Simulate an async request. Replace with real API calls.
        setTimeout(async () => {
            setIsLoading(false)
            if (currentType === 'login') {
                const userFound = await user.login(email, password)
                if (userFound.error) {
                    setMessage({type: 'error', text: userFound.error})
                    return
                }

                setMessage({type: 'success', text: `Logged in as ${email}`})
                // check if this user needs a type
                await afterAuthCheckType(userFound.user)
            } else {
                const userFound = await user.signup(email, password)
                if (userFound.error) {
                    setMessage({type: 'error', text: userFound.error})
                    return
                }
                setMessage({type: 'success', text: `Account created for ${email}`})
                await afterAuthCheckType(userFound.user)
            }
            // clear sensitive fields on success
            setPassword('')
            setConfirmPassword('')
        }, 1000)
    }

    // New: Google login handler
    const handleGoogleLogin = async (ev) => {
        ev && ev.preventDefault()
        setMessage(null)
        setIsLoading(true)
        try {
            const result = await user.googleLogin()
            setIsLoading(false)
            // If googleLogin initiated a redirect (fallback when popups blocked), inform the user
            if (result && result.redirect) {
                setMessage({ type: 'info', text: 'Redirecting to Google sign-in... please complete the sign-in and return to the app.' })
                // don't call afterAuthCheckType here; redirect will reload app and onAuthStateChanged will handle it
                return
            }
            if (result.error) {
                setMessage({type: 'error', text: result.error})
                return
            }
            setMessage({type: 'success', text: `Logged in as ${result.user?.email || 'Google User'}`})
            // check if this user needs a type
            await afterAuthCheckType(result.user)
        } catch (e) {
            setIsLoading(false)
            setMessage({type: 'error', text: e.message || String(e)})
        }
    }

    const chooseType = async (t) => {
        if (!fbUser) return
        setSettingType(true)
        const ok = await setUserType(fbUser.uid, t)
        setSettingType(false)
        if (ok) {
            setNeedsType(false)
            setMessage({type: 'success', text: `Account type set to ${t}`})
        } else {
            setMessage({type: 'error', text: 'Failed to set account type. Please try again.'})
        }
    }

    const toggleType = (ev) => {
        ev && ev.preventDefault()
        setMessage(null)
        setErrors({})
        setEmail('')
        setPassword('')
        setConfirmPassword('')
        setCurrentType((t) => (t === 'login' ? 'signin' : 'login'))
    }

    if (isLoading) {
        return (
            <div style={{padding: 24}}>
                <h2>{currentType === 'login' ? 'Logging in...' : 'Creating account...'}</h2>
                <p>Please wait.</p>
            </div>
        )
    }

    return (
        <div>
            <motion.div
                initial={{opacity: 0, y: -20}}
                animate={{opacity: 1, y: 0}}
                transition={{duration: 0.3}}
            >
                <div
                    className={"relative top-8 sm:top-20 justify-center border border-blue-400/30 w-full max-w-md mx-auto mt-6 sm:mt-12 px-4 sm:px-6 py-6 rounded-lg shadow-lg"}>
                    <h2 className={"font-bold p-2"}
                        style={{marginTop: 0}}>{currentType === 'login' ? 'Welcome Back !' : 'Sign Up'}</h2>

                    {message && (
                        <div style={{marginBottom: 12, color: message.type === 'success' ? 'lightgreen' : 'crimson'}}>
                            {message.text}
                        </div>
                    )}

                    <form onSubmit={handleSubmit} noValidate>
                        <div style={{marginBottom: 12}}>
                            <label htmlFor="email">Email</label>
                            <input
                                id="email"
                                type="email"
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                className={"block w-full px-3 py-2 mt-2 rounded bg-gray-50 text-black"}
                            />
                            {errors.email && <div style={{color: 'crimson', marginTop: 6}}>{errors.email}</div>}
                        </div>

                        <div style={{marginBottom: 12}}>
                            <label htmlFor="password">Password</label>
                            <input
                                id="password"
                                type="password"
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                className={"block w-full px-3 py-2 mt-2 rounded bg-gray-50 text-black"}
                            />
                            {errors.password && <div style={{color: 'crimson', marginTop: 6}}>{errors.password}</div>}
                        </div>

                        {currentType === 'signin' && (
                            <div style={{marginBottom: 12}}>
                                <label htmlFor="confirmPassword">Confirm password</label>
                                <input
                                    id="confirmPassword"
                                    type="password"
                                    value={confirmPassword}
                                    onChange={(e) => setConfirmPassword(e.target.value)}
                                    className={"block w-full px-3 py-2 mt-2 rounded bg-gray-50 text-black"}
                                />
                                {errors.confirmPassword &&
                                    <div style={{color: 'crimson', marginTop: 6}}>{errors.confirmPassword}</div>}
                            </div>
                        )}

                        <button className={"bg-white text-black rounded-2xl w-full py-2" } type="submit">
                            {currentType === 'login' ? 'Login' : 'Create account'}
                        </button>

                        {/* Google login button */}
                        <button type="button" onClick={handleGoogleLogin}
                                className={"w-full gap-2 mt-3 border  rounded-2xl flex items-center justify-center p-2"}>
                            <FcGoogle className={""} size={24}/>
                            <span className={"ml-2"}>Continue with Google</span>
                        </button>

                    </form>

                    <div className={"text-center"} style={{marginTop: 16}}>
                        {currentType === 'login' ? (
                            <>
                                <span>Don't have an account? </span>
                                <a href="#" onClick={toggleType}>Sign up</a>
                            </>
                        ) : (
                            <>
                                <span>Already have an account? </span>
                                <a href="#" onClick={toggleType}>Log in</a>
                            </>
                        )}
                    </div>
                </div>
            </motion.div>

            {/* If the signed-in user has no type, show a chooser panel */}
            {needsType && (
                <div className={"fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4"}>
                    <div className={"bg-white rounded-lg p-6 max-w-sm w-full text-center mx-4"}>
                        <h3 className={"font-bold mb-3"}>Select account type</h3>
                        <p className={"mb-3 text-sm text-gray-700"}>We couldn't find your account type. Please choose one to continue.</p>

                        <div className={"flex gap-3 justify-center mb-4"}>
                            <button onClick={() => chooseType('admin')} disabled={settingType}
                                    className={"px-4 py-2 rounded-md bg-blue-600 text-white"}>
                                {settingType ? 'Saving...' : 'Admin'}
                            </button>
                            <button onClick={() => chooseType('client')} disabled={settingType}
                                    className={"px-4 py-2 rounded-md bg-gray-200 text-black"}>
                                {settingType ? 'Saving...' : 'Client'}
                            </button>
                        </div>

                        <div className={"text-sm text-gray-600"}>
                            You can change this later in your profile.
                        </div>
                    </div>
                </div>
            )}
        </div>
    )
}

export default AuthLayout
