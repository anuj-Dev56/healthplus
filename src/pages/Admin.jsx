import React, { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { auth, db, getUserDocument, setReportStatus } from '../utils/firebase.js'
import { onAuthStateChanged } from 'firebase/auth'
import { collection, query, onSnapshot } from 'firebase/firestore'
import toast from 'react-hot-toast'
import AiComponent from '../components/AIComponent.jsx'
import { setReportStatus as setReportStatusFn } from '../utils/firebase.js'

const Admin = () => {
  const navigate = useNavigate()
  const [user, setUser] = useState(null)
  const [loadingAuth, setLoadingAuth] = useState(true)
  const [isAdmin, setIsAdmin] = useState(false)

  const [reports, setReports] = useState([])
  const [filter, setFilter] = useState('all')
  const [search, setSearch] = useState('')
  const [updatingIds, setUpdatingIds] = useState(new Set())

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (u) => {
      setUser(u)
      setLoadingAuth(false)
      if (!u) {
        navigate('/auth/login')
        return
      }
      // check user type
      try {
        const doc = await getUserDocument(u.uid)
        if (doc && doc.type === 'admin') setIsAdmin(true)
        else setIsAdmin(false)
      } catch (e) {
        console.error('getUserDocument error', e)
        setIsAdmin(false)
      }
    })
    return () => unsub()
  }, [navigate])

  useEffect(() => {
    if (!isAdmin) return
    const col = collection(db, 'reports')
    // no server-side ordering to avoid index requirements; we'll sort client-side
    const q = query(col)
    const unsub = onSnapshot(q, (snap) => {
      const items = []
      snap.forEach((d) => {
        const data = d.data()
        // normalize createdAt
        let createdAt = null
        if (data.createdAt && typeof data.createdAt.toDate === 'function') createdAt = data.createdAt.toDate()
        else if (data.createdAtClient) createdAt = new Date(data.createdAtClient)
        else if (data.createdAt) createdAt = new Date(data.createdAt)

        items.push({ id: d.id, ...data, createdAt })
      })
      // sort newest first using client timestamp then server date
      items.sort((a, b) => {
        const ta = a.createdAt ? (a.createdAt instanceof Date ? a.createdAt.getTime() : new Date(a.createdAt).getTime()) : 0
        const tb = b.createdAt ? (b.createdAt instanceof Date ? b.createdAt.getTime() : new Date(b.createdAt).getTime()) : 0
        return tb - ta
      })
      setReports(items)
    }, (err) => {
      console.error('admin reports onSnapshot error', err)
      toast.error('Failed to listen to reports: ' + String(err))
    })
    return () => unsub()
  }, [isAdmin])

  const counts = useMemo(() => {
    const c = { noise: 0, crowd: 0, traffic: 0, pollution: 0 }
    reports.forEach(r => { const t = (r.type || '').toLowerCase(); if (c[t] !== undefined) c[t] += 1 })
    return c
  }, [reports])

  const filtered = useMemo(() => {
    return reports.filter(r => {
      if (filter !== 'all' && (r.type || '') !== filter) return false
      if (!search) return true
      const s = search.toLowerCase()
      return (r.description || '').toLowerCase().includes(s) || (r.location || '').toLowerCase().includes(s) || (r.uid || '').toLowerCase().includes(s)
    })
  }, [reports, filter, search])

  const markResolved = async (id) => {
    if (!id) return
    setUpdatingIds(prev => new Set(prev).add(id))
    const res = await setReportStatus(id, 'resolved')
    setUpdatingIds(prev => { const s = new Set(prev); s.delete(id); return s })
    if (res.ok) toast.success('Marked resolved')
    else toast.error('Failed to mark resolved')
  }

  const markCleaned = async (id) => {
    if (!id) return
    setUpdatingIds(prev => new Set(prev).add(id))
    const res = await setReportStatus(id, 'cleaned')
    setUpdatingIds(prev => { const s = new Set(prev); s.delete(id); return s })
    if (res.ok) toast.success('Marked cleaned')
    else toast.error('Failed to mark cleaned')
  }

  const cleanupLocationAdmin = async (loc) => {
    if (!loc) return
    try {
      const targets = reports.filter(r => (r.location || 'Unknown').toString().trim() === loc)
      for (const r of targets) {
        await setReportStatusFn(r.id, 'cleaned')
      }
      toast.success('Cleanup applied')
    } catch (e) {
      console.error('cleanupLocationAdmin error', e)
      toast.error('Cleanup failed')
    }
  }

  if (loadingAuth) return <div className="min-h-screen flex items-center justify-center">Checking auth...</div>
  if (!user) return null
  if (!isAdmin) return (
    <div className="min-h-screen p-6">
      <div className="max-w-3xl mx-auto accent-gray-900 p-6 rounded shadow text-center">
        <h2 className="text-xl font-semibold">Access denied</h2>
        <p className="mt-2">You must be an admin to view this page.</p>
      </div>
    </div>
  )

  return (
    <div className="min-h-screen bg-gray-900 p-4 text-gray-100">
      <div className="max-w-6xl mx-auto grid grid-cols-1 lg:grid-cols-4 gap-4">
        <aside className="lg:col-span-1 bg-gray-800 p-4 rounded">
          <h3 className="font-semibold mb-2">Admin Panel</h3>
          <div className="text-sm text-gray-300 mb-2">Signed in as <strong className="text-white">{user.email}</strong></div>
          <div className="grid grid-cols-2 gap-2 mb-3">
            <div className="p-2 bg-gray-700 rounded text-center">Noise<br/><span className="font-bold">{counts.noise}</span></div>
            <div className="p-2 bg-gray-700 rounded text-center">Crowd<br/><span className="font-bold">{counts.crowd}</span></div>
            <div className="p-2 bg-gray-700 rounded text-center">Traffic<br/><span className="font-bold">{counts.traffic}</span></div>
            <div className="p-2 bg-gray-700 rounded text-center">Pollution<br/><span className="font-bold">{counts.pollution}</span></div>
          </div>

          <div className="mb-3">
            <label className="text-xs text-gray-300">Filter</label>
            <select value={filter} onChange={(e) => setFilter(e.target.value)} className="w-full mt-1 p-2 bg-gray-700 rounded text-white">
              <option value="all">All</option>
              <option value="noise">Noise</option>
              <option value="crowd">Crowd</option>
              <option value="traffic">Traffic</option>
              <option value="pollution">Pollution</option>
            </select>
          </div>

          <div>
            <label className="text-xs text-gray-300">Search</label>
            <input value={search} onChange={e => setSearch(e.target.value)} className="w-full mt-1 p-2 bg-gray-700 rounded text-white" placeholder="text, location, uid" />
          </div>

          {/* AI component in sidebar for admins */}
          <div className="mt-4">
            <AiComponent reports={reports} topN={5} onMarkReport={async (id, status) => {
              // use existing setReportStatus wrapper
              setUpdatingIds(prev => new Set(prev).add(id))
              const res = await setReportStatusFn(id, status)
              setUpdatingIds(prev => { const s = new Set(prev); s.delete(id); return s })
              if (res.ok) toast.success('Updated')
              else toast.error('Failed')
            }} onCleanupLocation={cleanupLocationAdmin} />
          </div>
        </aside>

        <main className="lg:col-span-3 bg-gray-800 p-4 rounded">
          <h2 className="font-semibold mb-3">Reports ({filtered.length})</h2>
          {filtered.length === 0 ? (
            <div className="text-sm text-gray-400">No reports found.</div>
          ) : (
            <ul className="space-y-3">
              {filtered.map(r => (
                <li key={r.id} className="bg-gray-700 p-3 rounded flex flex-col sm:flex-row justify-between gap-3">
                  <div className="flex-1">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <div className="font-medium capitalize">{r.type} <span className="text-xs text-gray-300">[{r.status}]</span></div>
                        <div className="text-xs text-gray-400">By: {r.uid}</div>
                      </div>
                      <div className="text-xs text-gray-400">{r.createdAt ? new Date(r.createdAt).toLocaleString() : ''}</div>
                    </div>

                    <div className="mt-2 text-sm text-gray-200">{r.description || <em className="text-gray-400">No description</em>}</div>
                    {r.location && <div className="mt-2 text-xs text-gray-300">Location: {r.location}</div>}
                  </div>

                  <div className="flex flex-col sm:items-end gap-2">
                    <button onClick={() => markResolved(r.id)} disabled={updatingIds.has(r.id) || r.status === 'resolved'} className="px-3 py-1 rounded bg-indigo-600 text-white text-sm">
                      {updatingIds.has(r.id) ? 'Updating...' : (r.status === 'resolved' ? 'Resolved' : 'Mark resolved')}
                    </button>
                    <button onClick={() => markCleaned(r.id)} disabled={updatingIds.has(r.id) || r.status === 'cleaned'} className="px-3 py-1 rounded bg-green-600 text-white text-sm">
                      {updatingIds.has(r.id) ? 'Updating...' : (r.status === 'cleaned' ? 'Cleaned' : 'Mark cleaned')}
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </main>
      </div>
    </div>
  )
}

export default Admin
