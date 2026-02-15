import React, { useEffect, useState, useMemo } from 'react'
import { Search } from 'lucide-react'
import { db } from '../utils/firebase.js'
import { collection, query, onSnapshot } from 'firebase/firestore'

const Reports = () => {
  const [reports, setReports] = useState([])
  const [loading, setLoading] = useState(true)
  const [q, setQ] = useState('')

  useEffect(() => {
    setLoading(true)
    const col = collection(db, 'reports')
    const qry = query(col)
    const unsub = onSnapshot(qry, (snap) => {
      const items = []
      snap.forEach(doc => {
        const d = doc.data()
        // normalize createdAt (server Timestamp) or fallback to client ts
        let createdAt = null
        if (d.createdAt && typeof d.createdAt.toDate === 'function') createdAt = d.createdAt.toDate()
        else if (d.createdAtClient) createdAt = new Date(d.createdAtClient)
        else if (d.createdAt) createdAt = new Date(d.createdAt)

        items.push({ id: doc.id, ...d, createdAt })
      })
      // sort newest first
      items.sort((a, b) => {
        const ta = a.createdAt ? (a.createdAt instanceof Date ? a.createdAt.getTime() : new Date(a.createdAt).getTime()) : 0
        const tb = b.createdAt ? (b.createdAt instanceof Date ? b.createdAt.getTime() : new Date(b.createdAt).getTime()) : 0
        return tb - ta
      })
      setReports(items)
      setLoading(false)
      console.debug('reports snapshot', items)
    }, (err) => {
      console.error('reports onSnapshot error', err)
      setLoading(false)
    })

    return () => unsub()
  }, [])

  const filtered = useMemo(() => {
    if (!q) return reports
    const s = q.toLowerCase()
    return reports.filter(r => {
      return (
        (r.location || '').toString().toLowerCase().includes(s) ||
        (r.description || '').toString().toLowerCase().includes(s) ||
        (r.uid || '').toString().toLowerCase().includes(s)
      )
    })
  }, [reports, q])

  const formatDate = (d) => {
    if (!d) return ''
    if (d instanceof Date) return d.toLocaleString()
    try { return new Date(d).toLocaleString() } catch { return '' }
  }

  return (
    <div className="min-h-screen p-4 bg-gray-900 text-gray-100">
      <div className="max-w-4xl mx-auto">
        <header className="mb-6">
          <h1 className="text-3xl font-extrabold mb-1">Community reports</h1>
          <p className="text-gray-300">Recent issues reported by people in your area. Use the search to find specific locations or descriptions.</p>
        </header>

        <div className="flex flex-col sm:flex-row gap-2 items-center mb-4">
          <label className="sr-only">Search reports</label>
          <input
            value={q}
            onChange={e => setQ(e.target.value)}
            placeholder="Search reports by location, description, or user"
            className="flex-1 p-3 rounded-lg bg-gray-800 border border-gray-700 text-gray-100 focus:outline-none focus:ring-2 focus:ring-indigo-600"
          />
          <button className="px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white flex items-center gap-2 shadow-sm">
            <Search size={16} />
            Find
          </button>
        </div>

        <div className="mb-4 text-sm text-gray-300">Showing <strong className="text-white">{filtered.length}</strong> of <strong className="text-white">{reports.length}</strong> reports</div>

        {loading ? (
          <div className="py-12 text-center text-gray-400">Loading reports — please wait…</div>
        ) : filtered.length === 0 ? (
          <div className="py-12 text-center text-gray-400">No reports found. Be the first to report an issue in your area!</div>
        ) : (
          <ul className="space-y-4">
            {filtered.map(r => (
              <li key={r.id} className="bg-gray-800 p-4 rounded-xl shadow-sm border border-gray-700">
                <div className="flex flex-col sm:flex-row sm:justify-between sm:items-start gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-3">
                      <div className="truncate">
                        <div className="font-semibold text-white capitalize">{r.type}</div>
                        <div className="text-xs text-gray-300 truncate">{r.location || 'Location not provided'}</div>
                      </div>
                      <div className="text-xs text-gray-400 whitespace-nowrap">{formatDate(r.createdAt)}</div>
                    </div>

                    <div className="mt-2 text-sm text-gray-200">{r.description || <em className="text-gray-400">No additional details provided</em>}</div>
                    <div className="mt-3 text-xs text-gray-400">Reported by: <span className="text-white">{r.uid}</span></div>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  )
}

export default Reports
