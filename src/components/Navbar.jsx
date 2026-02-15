import React, {useEffect, useState} from 'react'
import {onAuthStateChanged, signOut} from "firebase/auth";
import {auth, getUserDocument} from "../utils/firebase.js";

const Navbar = () => {
    const [user, setUser] = useState(null)
    const [open, setOpen] = useState(false)
    const [UserDocument, setUserDocument] = useState(null)
    const [links, setLinks] = useState([])

    useEffect(() => {
        const unsub = onAuthStateChanged(auth, async (u) => {
            setUser(u)
            if (u) {
                try {
                    const userDoc = await getUserDocument(u.uid)
                    // set the Firestore user document (not the auth user)
                    setUserDocument(userDoc || null)
                } catch (err) {
                    console.error('Failed to load user document', err)
                    setUserDocument(null)
                }
            } else {
                // not signed in
                setUserDocument(null)
            }
        })
        return () => unsub()
    }, [])


    useEffect(() => {
        const onKey = (e) => {
            if (e.key === 'Escape') setOpen(false)
        }
        const onResize = () => {
            if (window.innerWidth > 768) setOpen(false)
        }
        window.addEventListener('keydown', onKey)
        window.addEventListener('resize', onResize)
        return () => {
            window.removeEventListener('keydown', onKey)
            window.removeEventListener('resize', onResize)
        }
    }, [])

    const handleSignOut = async () => {
        try {
            await signOut(auth)
            setUser(null)
            setUserDocument(null)
            // reset to default public links
            setLinks([{ label: 'Home', href: '/' }, { label: 'Reports', href: '/reports' }, { label: 'Contact', href: '/contact' }])
        } catch (e) {
            console.error('Sign out error', e)
        }
    }


    useEffect(() => {
        // Update nav links whenever user or the user's Firestore doc changes
        if (UserDocument && UserDocument.type) {
            if (UserDocument.type === 'admin') {
                setLinks([
                    {label: 'Dashboard', href: '/admin'},
                    {label: 'Reports', href: '/reports'},
                ])
            } else if (UserDocument.type === 'client') {
                setLinks([
                    {label: 'Home', href: '/dashboard'},
                    {label: 'Reports', href: '/reports'},
                ])
            } else {
                setLinks([
                    {label: 'Home', href: '/dashboard'},
                    {label: 'Reports', href: '/reports'},
                    {label: 'Contact', href: '/contact'}
                ])
            }
        } else {
            // fallback links for authenticated users without a Firestore doc, or public users
            if (user) {
                setLinks([
                    {label: 'Home', href: '/dashboard'},
                    {label: 'Reports', href: '/reports'},
                ])
            } else {
                setLinks([
                    {label: 'Home', href: '/'},
                    {label: 'Reports', href: '/reports'},
                    {label: 'Contact', href: '/contact'}
                ])
            }
        }
    }, [UserDocument, user]);

    return (
        <header className="sticky top-0 z-50 bg-transparent">
            {/* translucent blurred background bar */}
            <div
                className="backdrop-blur-sm bg-black/50 dark:bg-black/60 border-b border-black/20 dark:border-gray-700">
                <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
                    <div className="flex items-center justify-between h-16">
                        <div className="flex items-center gap-3">
                            {/* Mobile menu button */}
                            <button
                                onClick={() => setOpen(true)}
                                aria-label="Open menu"
                                className="md:hidden inline-flex items-center justify-center p-3 rounded-md text-gray-200 hover:bg-white/5 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 touch-manipulation"
                            >
                                <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                                          d="M4 6h16M4 12h16M4 18h16"/>
                                </svg>
                            </button>

                            <a href="/" className="flex items-center gap-3 text-white">
                                <span className="font-semibold">HealthPlus</span>
                            </a>
                        </div>

                        {/* Desktop nav */}
                        <nav className="hidden md:flex items-center gap-6">
                            {links.map((l) => (
                                <a key={l.href} href={l.href}
                                   className="text-gray-200 hover:text-white transition-colors text-sm">
                                    {l.label}
                                </a>
                            ))}
                        </nav>

                        <div className="hidden md:flex items-center gap-4">
                            {user ? (
                                <>
                                    <img className={"rounded-full w-7 h-7 object-cover"} src={user.photoURL}
                                         alt={user.email}/>
                                    <button onClick={handleSignOut}
                                            className="px-3 py-1 rounded-md bg-white/6 hover:bg-white/10 text-sm text-white">Sign
                                        out
                                    </button>
                                </>
                            ) : (
                                <a href="/auth/login"
                                   className="px-3 py-1 rounded-md bg-white/6 hover:bg-white/10 text-sm text-white">Log
                                    in</a>
                            )}
                        </div>
                    </div>
                </div>
            </div>

            {/* Mobile sidebar/drawer */}
            {/* overlay */}
            <div
                className={`fixed inset-0 z-40 transition-opacity ${open ? 'pointer-events-auto' : 'pointer-events-none'}`}
                aria-hidden={!open}
            >
                <div
                    className={`absolute inset-0 bg-black/50 backdrop-blur-sm transition-opacity ${open ? 'opacity-100' : 'opacity-0'}`}
                    onClick={() => setOpen(false)}
                />

                {/* sidebar panel */}
                <aside
                    className={`fixed left-0 top-0 h-full w-72 bg-gray-900 text-gray-100 shadow-xl transform transition-transform ${open ? 'translate-x-0' : '-translate-x-full'}`}
                    role="dialog"
                    aria-modal="true"
                >
                    <div className="flex items-center justify-between px-4 py-4 border-b border-gray-800">
                        <div className="flex items-center gap-3">
                            <div className="font-semibold">HealthPlus</div>
                        </div>
                        <button
                            onClick={() => setOpen(false)}
                            aria-label="Close menu"
                            className="p-2 rounded-md hover:bg-white/5 touch-manipulation"
                        >
                            <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                                      d="M6 18L18 6M6 6l12 12"/>
                            </svg>
                        </button>
                    </div>

                    <div className="px-4 py-6 flex flex-col gap-3">
                        {links.map((l) => (
                            <a key={l.href} href={l.href} onClick={() => setOpen(false)}
                               className="block w-full text-left px-4 py-3 rounded-md hover:bg-white/5 touch-manipulation">{l.label}</a>
                        ))}
                    </div>

                    <div className="mt-auto px-4 py-6 border-t border-gray-800">
                        {user ? (
                            <div className="flex flex-col gap-2">
                                <div className="text-sm text-gray-300">Signed in as</div>
                                <div className="font-medium truncate">{user.email}</div>
                                <button onClick={() => {
                                    setOpen(false);
                                    handleSignOut()
                                }} className="mt-3 w-full px-3 py-2 rounded-md bg-white/6 hover:bg-white/10">Sign out
                                </button>
                            </div>
                        ) : (
                            <a href="/auth/login" onClick={() => setOpen(false)}
                               className="block w-full text-center px-3 py-2 rounded-md bg-white/6 hover:bg-white/10">Log
                                in</a>
                        )}
                    </div>
                </aside>
            </div>
        </header>
    )
}

export default Navbar
