import React, {useEffect, useMemo, useState} from 'react'
import {useNavigate} from 'react-router-dom'
import {auth, sendReport, db, setReportStatus} from '../utils/firebase.js'
import {onAuthStateChanged} from 'firebase/auth'
import {collection, query, where, onSnapshot, getDocs} from 'firebase/firestore'
import toast from 'react-hot-toast'

const Dashboard = () => {
    const navigate = useNavigate()
    const [user, setUser] = useState(null)
    const [loadingAuth, setLoadingAuth] = useState(true)

    const [type, setType] = useState('noise')
    const [description, setDescription] = useState('')
    const [location, setLocation] = useState('')
    const [sending, setSending] = useState(false)

    const [reports, setReports] = useState([])
    const [filterType, setFilterType] = useState('all')
    const [cleaningIds, setCleaningIds] = useState(new Set())
    const [cleaningLocation, setCleaningLocation] = useState(null)
    const [lastSendResult, setLastSendResult] = useState(null)

    useEffect(() => {
        const unsub = onAuthStateChanged(auth, (u) => {
            setUser(u)
            setLoadingAuth(false)
            if (!u) {
                navigate('/')
            }
        })
        return () => unsub()
    }, [navigate])

    useEffect(() => {
        if (!user) return
        const col = collection(db, 'reports')
        // Query documents for this user; we'll sort client-side to avoid composite index requirements
        const q = query(col, where('uid', '==', user.uid))
        const unsub = onSnapshot(q, (snapshot) => {
            const items = []
            snapshot.forEach(doc => {
                const d = doc.data()
                // normalize createdAt to JS Date for consistent display
                let createdAt = null
                if (d.createdAt && typeof d.createdAt.toDate === 'function') {
                    createdAt = d.createdAt.toDate()
                } else if (d.createdAtClient) {
                    try { createdAt = new Date(d.createdAtClient) } catch(e) { createdAt = null }
                } else if (d.createdAt) {
                    try { createdAt = new Date(d.createdAt) } catch(e) { createdAt = null }
                }
                items.push({ id: doc.id, ...d, createdAt })
            })
            // sort by createdAtClient desc (newest first), then by ID for consistent ordering
            items.sort((a,b) => {
                const diff = (b.createdAtClient || 0) - (a.createdAtClient || 0)
                if (diff !== 0) return diff
                return (b.id || '').localeCompare(a.id || '')
            })
            setReports(items)
            console.debug('reports snapshot', items)
        }, (err) => {
            console.error('reports onSnapshot error', err)
        })

        return () => {
            unsub()
        }
    }, [user])

    const submitReport = async (ev) => {
        ev && ev.preventDefault()
        if (!user) return
        setSending(true)
        const res = await sendReport(user.uid, { type, description, location: location || null })
        setSending(false)
        console.debug('sendReport result', res)
        setLastSendResult(res || null)
        if (!res.ok) {
            toast.error('Failed to send report: ' + (res.error || 'unknown'))
            return
        }

        // optimistic add: show immediately while realtime listener confirms
        const newItem = {
            id: res.id || `temp-${Date.now()}`,
            uid: user.uid,
            type: (type || '').toLowerCase(),
            description: description || null,
            location: location || null,
            status: 'new',
            createdAt: new Date(),
            createdAtClient: Date.now(),
            optimistic: true
        }
        setReports(prev => [newItem, ...prev])
        toast.success('Report queued')

        if (res.ok) {
            setDescription('')
            setLocation('')
        }
    }

    // Computed metrics
    const summary = useMemo(() => {
        const counts = { noise: 0, crowd: 0, traffic: 0, pollution: 0 }
        reports.forEach(r => {
            const t = (r.type || '').toLowerCase()
            if (counts[t] !== undefined) counts[t] += 1
        })
        return counts
    }, [reports])

    // Location heatmap: aggregate by location string
    const locationBuckets = useMemo(() => {
        const map = new Map()
        reports.forEach(r => {
            const loc = (r.location || 'Unknown').trim() || 'Unknown'
            map.set(loc, (map.get(loc) || 0) + 1)
        })
        // convert to array sorted by count desc
        const arr = Array.from(map.entries()).map(([loc, count]) => ({ loc, count }))
        arr.sort((a,b) => b.count - a.count)
        return arr
    }, [reports])

    const maxBucket = locationBuckets.length ? locationBuckets[0].count : 1

    const colorForCount = (count) => {
        // simple gradient from dark teal -> orange -> red for dark theme
        const ratio = Math.min(1, (count / (maxBucket || 1)))
        const r = Math.round(220 * ratio + 35 * (1 - ratio))
        const g = Math.round(80 * (1 - ratio) + 120 * ratio)
        const b = Math.round(60 * (1 - ratio))
        return `rgb(${r},${g},${b})`
    }

    const markCleaned = async (reportId) => {
        if (!reportId) return
        setCleaningIds(prev => new Set(prev).add(reportId))
        const res = await setReportStatus(reportId, 'cleaned')
        setCleaningIds(prev => { const s = new Set(prev); s.delete(reportId); return s })
        if (!res.ok) console.error('Failed to mark cleaned', res.error)
    }

    const cleanupLocation = async (loc) => {
        setCleaningLocation(loc)
        const targets = reports.filter(r => (r.location||'Unknown').trim() === loc)
        for (const r of targets) {
            await setReportStatus(r.id, 'cleaned')
        }
        setCleaningLocation(null)
    }

    const fetchReportsNow = async () => {
        if (!user) return
        try {
            const col = collection(db, 'reports')
            const q = query(col, where('uid', '==', user.uid))
            const snap = await getDocs(q)
            const items = []
            snap.forEach(doc => {
                const d = doc.data()
                let createdAt = null
                if (d.createdAt && typeof d.createdAt.toDate === 'function') createdAt = d.createdAt.toDate()
                else if (d.createdAtClient) createdAt = new Date(d.createdAtClient)
                else if (d.createdAt) createdAt = new Date(d.createdAt)
                items.push({ id: doc.id, ...d, createdAt })
            })
            console.debug('fetchReportsNow', items)
            // sort by createdAtClient desc (newest first), then by ID for consistent ordering
            items.sort((a,b) => {
                const diff = (b.createdAtClient || 0) - (a.createdAtClient || 0)
                if (diff !== 0) return diff
                return (b.id || '').localeCompare(a.id || '')
            })
            setReports(items)
            toast.success('Fetched ' + items.length + ' reports')
        } catch (e) {
            console.error('fetchReportsNow error', e)
            toast.error('Failed to fetch reports: ' + String(e))
        }
    }

    const filteredReports = filterType === 'all' ? reports : reports.filter(r => (r.type||'') === filterType)

    const formatDate = (d) => {
        if (!d) return ''
        // Firestore Timestamp has toDate()
        if (d && typeof d.toDate === 'function') {
            try { return d.toDate().toLocaleString() } catch (e) { return '' }
        }
        if (d instanceof Date) return d.toLocaleString()
        if (typeof d === 'number') return new Date(d).toLocaleString()
        try { return new Date(d).toLocaleString() } catch (e) { return '' }
    }

    if (loadingAuth) {
        return <div className={"min-h-screen flex items-center justify-center"}>Checking authentication...</div>
    }

    return (
        <div className={"min-h-screen rounded bg-gray-900 p-6 text-gray-100"}>
            <div className={"max-w-6xl mx-auto grid grid-cols-1 lg:grid-cols-3 gap-6"}>
                {/* Left: controls and form */}
                <div className={"lg:col-span-2 bg-gray-800 p-6 rounded shadow text-gray-100"}>
                    <h1 className={"text-2xl font-bold mb-2 text-white"}>Dashboard</h1>
                    <p className={"text-sm text-gray-300 mb-4"}>Report issues in real-time to admins (noise, crowd, traffic, pollution).</p>

                    <div className={"mb-4 flex-col flex gap-3 items-center"}>
                        <div className={"px-3 py-2 bg-gray-700 rounded text-sm text-gray-100"}>Logged in as <strong className={"ml-2 text-white"}>{user?.email}</strong></div>
                        <div className={"ml-auto flex items-center gap-2"}>
                            <label className={"text-sm text-gray-300"}>Filter:</label>
                            <select value={filterType} onChange={(e) => setFilterType(e.target.value)} className={"border rounded p-1 bg-gray-800 text-gray-100 border-gray-700"}>
                                <option value="all">All</option>
                                <option value="noise">Noise</option>
                                <option value="crowd">Crowd</option>
                                <option value="traffic">Traffic</option>
                                <option value="pollution">Pollution</option>
                            </select>
                        </div>
                    </div>

                    <form onSubmit={submitReport} className={"space-y-3 mb-6"}>
                        <div className={"grid grid-cols-1 md:grid-cols-3 gap-3"}>
                            <select value={type} onChange={(e
                            ) => setType(e.target.value)} className={"border rounded p-2 bg-gray-800 text-gray-100 border-gray-700"}>
                                <option value="noise">Noise</option>
                                <option value="crowd">Crowd</option>
                                <option value="traffic">Traffic</option>
                                <option value="pollution">Pollution</option>
                            </select>

                            <input value={location} onChange={(e) => setLocation(e.target.value)} placeholder={"Location (city / area)"} className={"border rounded p-2 bg-gray-800 text-gray-100 border-gray-700"} />

                            <button type="submit" disabled={sending} className={"px-4 py-2 bg-blue-600 text-white rounded shadow"}>
                                {sending ? 'Sending...' : 'Send report'}
                            </button>
                        </div>

                        <div>
                            <textarea value={description} onChange={(e) => setDescription(e.target.value)} className={"w-full border rounded p-2 bg-gray-800 text-gray-100 border-gray-700"} rows={3} placeholder={"Add more details (optional)"} />
                        </div>
                    </form>

                    <div className={"mb-4 grid grid-cols-2 sm:grid-cols-4 gap-3"}>
                        <div className={"p-3 bg-gray-800 rounded text-center border border-gray-700"}>
                            <div className={"text-sm text-gray-400"}>Noise</div>
                            <div className={"text-xl font-bold text-white"}>{summary.noise}</div>
                        </div>
                        <div className={"p-3 bg-gray-800 rounded text-center border border-gray-700"}>
                            <div className={"text-sm text-gray-400"}>Crowd</div>
                            <div className={"text-xl font-bold text-white"}>{summary.crowd}</div>
                        </div>
                        <div className={"p-3 bg-gray-800 rounded text-center border border-gray-700"}>
                            <div className={"text-sm text-gray-400"}>Traffic</div>
                            <div className={"text-xl font-bold text-white"}>{summary.traffic}</div>
                        </div>
                        <div className={"p-3 bg-gray-800 rounded text-center border border-gray-700"}>
                            <div className={"text-sm text-gray-400"}>Pollution</div>
                            <div className={"text-xl font-bold text-white"}>{summary.pollution}</div>
                        </div>
                    </div>

                    {/* AI prediction */}
                    {/* Debug panel: shows last sendReport response */}
                    {lastSendResult && (
                        <div className={"mb-4 p-3 rounded border bg-gray-800 border-gray-700 text-xs text-gray-300"}>
                            <div className={"font-semibold mb-1 text-sm text-white"}>Last send response</div>
                            <div>ID: <span className={"font-mono text-xs text-gray-200"}>{lastSendResult.id || '—'}</span></div>
                            <div>OK: {String(!!lastSendResult.ok)}</div>
                            {lastSendResult.error && <div className={"text-red-400"}>Error: {String(lastSendResult.error)}</div>}
                            {lastSendResult.data && <div className={"mt-2 text-xs break-words"}>{JSON.stringify(lastSendResult.data)}</div>}
                        </div>
                    )}

                    {/* Reports list */}
                    <section>
                        <h2 className={"text-lg font-semibold mb-2 text-white"}>Your reports</h2>
                        {filteredReports.length === 0 ? (
                            <div className={"text-sm text-gray-400"}>No reports yet.</div>
                        ) : (
                            <ul className={"space-y-3"}>
                                {filteredReports.map(r => (
                                    <li key={r.id} className={"border rounded p-3 bg-gray-800 flex justify-between items-start border-gray-700"}>
                                        <div>
                                            <div className={"font-medium capitalize text-white"}>{r.type} <span className={"text-xs text-gray-400 ml-2"}>[{r.status}]</span></div>
                                            <div className={"text-sm text-gray-300 mt-1"}>{r.description || <em className={"text-gray-400"}>No description</em>}</div>
                                            {r.location && <div className={"text-xs text-gray-400 mt-1"}>Location: {r.location}</div>}
                                            <div className={"text-xs text-gray-500 mt-2"}>{formatDate(r.createdAt)}</div>
                                        </div>

                                        <div className={"flex flex-col gap-2 ml-4 items-end"}>
                                            <button onClick={() => markCleaned(r.id)} disabled={cleaningIds.has(r.id) || r.status === 'cleaned'} className={"px-3 py-1 rounded text-white text-sm"}
                                                    style={{ background: r.status === 'cleaned' ? '#6b7280' : '#059669' }}>
                                                {cleaningIds.has(r.id) ? 'Cleaning...' : (r.status === 'cleaned' ? 'Cleaned' : 'Mark cleaned')}
                                            </button>
                                        </div>
                                    </li>
                                ))}
                            </ul>
                        )}
                    </section>
                </div>

                {/* Right column: heatmap and actions */}
                <aside className={"bg-gray-900 p-6 rounded shadow border border-gray-700 text-black"}>
                        <h3 className={"font-semibold mb-3 text-white"}>City-level heatmap</h3>
                    <div className={"grid grid-cols-2 gap-3 mb-4"}>
                        {locationBuckets.length === 0 ? (
                            <div className={"text-sm text-gray-500 col-span-2"}>No location data yet.</div>
                        ) : locationBuckets.slice(0, 8).map(b => (
                            <div key={b.loc} className={"p-3 rounded text-center flex flex-col items-center justify-center"}
                                 style={{
                                     background: colorForCount(b.count),
                                     minHeight: 80,
                                     color: '#ffffff',
                                     boxShadow: 'inset 0 -4px 8px rgba(0,0,0,0.15)'
                                 }}>
                                <div className={"text-sm font-medium truncate w-full"} title={b.loc}>{b.loc}</div>
                                <div className={"text-lg font-bold mt-1"}>{b.count}</div>
                                <button onClick={() => cleanupLocation(b.loc)} disabled={cleaningLocation === b.loc} className={"mt-2 text-xs px-3 py-1 rounded bg-white/10 text-black border border-white/20"}>
                                    {cleaningLocation === b.loc ? 'Cleaning...' : 'Mark cleaned'}
                                </button>
                            </div>
                        ))}
                    </div>
                    <div className={"text-xs text-gray-400 mb-3"}>Heatmap shows report concentration by location (higher = darker).</div>

                    <div className={"mt-4"}>
                        <h4 className={"text-sm font-semibold mb-2 text-white"}>Quick actions</h4>
                        <div className={"flex flex-col gap-2"}>
                            <button onClick={() => { setFilterType('all') }} className={"px-3 py-2 rounded border text-sm bg-gray-800 text-gray-100 border-gray-700"}>Show all</button>
                            <button onClick={() => { setFilterType('noise') }} className={"px-3 py-2 rounded border text-sm bg-gray-800 text-gray-100 border-gray-700"}>Show noise</button>
                            <button onClick={() => { setFilterType('traffic') }} className={"px-3 py-2 rounded border text-sm bg-gray-800 text-gray-100 border-gray-700"}>Show traffic</button>
                            <button onClick={fetchReportsNow} className={"px-3 py-2 rounded border text-sm bg-gray-800 text-gray-100 border-gray-700"}>Fetch reports now</button>
                        </div>
                    </div>
                </aside>
            </div>
        </div>
    )
}

export default Dashboard
