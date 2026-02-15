import React, { useMemo, useState } from 'react'
import toast from 'react-hot-toast'
import { setReportStatus } from '../utils/firebase.js'

const AiComponent = ({ reports = [], topN = 5, onCleanupLocation, onMarkReport, aiPredictFn, aiPredictUrl }) => {
  const [busyIds, setBusyIds] = useState(new Set())
  const [busyLocation, setBusyLocation] = useState(null)
  const [aiLoading, setAiLoading] = useState(false)
  const [aiResult, setAiResult] = useState(null)

  // Analyze counts by type and by recent window
  const analysis = useMemo(() => {
    const counts = { noise: 0, crowd: 0, traffic: 0, pollution: 0 }
    const byLocation = new Map()
    const recent = reports.slice(0, 50) // look-back window

    recent.forEach(r => {
      const t = (r.type || '').toLowerCase()
      if (counts[t] !== undefined) counts[t] += 1
      const loc = (r.location || 'Unknown').toString().trim() || 'Unknown'
      byLocation.set(loc, (byLocation.get(loc) || 0) + 1)
    })

    const locArr = Array.from(byLocation.entries()).map(([loc, count]) => ({ loc, count }))
    locArr.sort((a, b) => b.count - a.count)

    // simple trending heuristic: check frequency in last 5 vs previous 5
    const trend = { type: null, confidence: 0 }
    if (reports.length >= 5) {
      const last5 = reports.slice(0, 5)
      const prev5 = reports.slice(5, 10)
      const freq = {}
      last5.forEach(r => { const t = (r.type||'').toLowerCase(); freq[t] = (freq[t]||0)+1 })
      const freqPrev = {}
      prev5.forEach(r => { const t = (r.type||'').toLowerCase(); freqPrev[t] = (freqPrev[t]||0)+1 })
      let best = null; let bestDelta = 0
      Object.keys(counts).forEach(k => {
        const a = freq[k] || 0
        const b = freqPrev[k] || 0
        const delta = a - b
        if (delta > bestDelta) { bestDelta = delta; best = k }
      })
      if (best && bestDelta > 0) {
        trend.type = best
        trend.confidence = Math.min(1, bestDelta / 5)
      }
    }

    return { counts, hotspots: locArr.slice(0, topN), trend }
  }, [reports, topN])

  // sample reports per hotspot (first recent match)
  const hotspotSamples = useMemo(() => {
    return analysis.hotspots.map(h => ({ loc: h.loc, sample: reports.find(r => (r.location || '').toString().trim() === h.loc) || null }))
  }, [analysis.hotspots, reports])

  const runAiPredict = async () => {
    setAiResult(null)
    setAiLoading(true)
    try {
      if (aiPredictFn) {
        const res = await aiPredictFn(reports)
        setAiResult(res)
      } else if (aiPredictUrl) {
        const resp = await fetch(aiPredictUrl, {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ reports })
        })
        const data = await resp.json().catch(() => null)
        setAiResult(data || { text: 'No response' })
      } else {
        // fallback: simple summary based on existing heuristic
        const text = analysis.trend.type ? `Likely increase in ${analysis.trend.type} (conf ${Math.round(analysis.trend.confidence*100)}%)` : 'No strong trend detected'
        setAiResult({ text, summary: analysis })
      }
      toast.success('AI run complete')
    } catch (e) {
      console.error('runAiPredict error', e)
      toast.error('AI prediction failed')
      setAiResult({ error: String(e) })
    } finally {
      setAiLoading(false)
    }
  }

  const handleMarkReport = async (id, status = 'cleaned') => {
    if (!id) return
    if (onMarkReport) {
      try {
        setBusyIds(prev => new Set(prev).add(id))
        await onMarkReport(id, status)
        toast.success('Updated')
      } catch (e) {
        console.error('onMarkReport error', e)
        toast.error('Failed to update')
      } finally {
        setBusyIds(prev => { const s = new Set(prev); s.delete(id); return s })
      }
      return
    }

    // fallback to calling setReportStatus directly
    try {
      setBusyIds(prev => new Set(prev).add(id))
      const res = await setReportStatus(id, status)
      if (res.ok) toast.success('Updated')
      else toast.error('Failed to update')
    } catch (e) {
      console.error('setReportStatus error', e)
      toast.error('Update failed')
    } finally {
      setBusyIds(prev => { const s = new Set(prev); s.delete(id); return s })
    }
  }

  const handleCleanupLocation = async (loc) => {
    if (!loc) return
    if (onCleanupLocation) {
      try {
        setBusyLocation(loc)
        await onCleanupLocation(loc)
        toast.success('Cleanup applied')
      } catch (e) {
        console.error('onCleanupLocation error', e)
        toast.error('Cleanup failed')
      } finally {
        setBusyLocation(null)
      }
      return
    }

    // fallback: mark all reports in location as cleaned
    try {
      setBusyLocation(loc)
      const targets = reports.filter(r => (r.location || 'Unknown').toString().trim() === loc)
      for (const r of targets) {
        await setReportStatus(r.id, 'cleaned')
      }
      toast.success('Cleanup applied to location')
    } catch (e) {
      console.error('cleanupLocation error', e)
      toast.error('Cleanup failed')
    } finally {
      setBusyLocation(null)
    }
  }

  return (
    <div className="bg-gray-800 p-4 rounded space-y-4">
      <h3 className="font-semibold text-lg">AI — Patterns & Cleanup</h3>

      <div className="flex items-center gap-2">
        <button onClick={runAiPredict} disabled={aiLoading} className="px-3 py-1 rounded bg-indigo-600 text-white text-sm">
          {aiLoading ? 'Running AI...' : 'Run AI (Gemini)'}
        </button>
        {aiResult && (
          <div className="text-sm text-gray-300">{aiResult.error ? `Error: ${aiResult.error}` : (aiResult.text || JSON.stringify(aiResult))}</div>
        )}
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <div className="p-3 bg-gray-700 rounded text-center">
          <div className="text-xs text-gray-300">Noise</div>
          <div className="text-xl font-bold text-white">{analysis.counts.noise}</div>
        </div>
        <div className="p-3 bg-gray-700 rounded text-center">
          <div className="text-xs text-gray-300">Crowd</div>
          <div className="text-xl font-bold text-white">{analysis.counts.crowd}</div>
        </div>
        <div className="p-3 bg-gray-700 rounded text-center">
          <div className="text-xs text-gray-300">Traffic</div>
          <div className="text-xl font-bold text-white">{analysis.counts.traffic}</div>
        </div>
        <div className="p-3 bg-gray-700 rounded text-center">
          <div className="text-xs text-gray-300">Pollution</div>
          <div className="text-xl font-bold text-white">{analysis.counts.pollution}</div>
        </div>
      </div>

      <div className="p-3 bg-gray-900 rounded">
        <div className="flex items-center justify-between">
          <div>
            <div className="text-sm font-medium">Prediction</div>
            <div className="text-xs text-gray-300">Simple pattern detection from recent reports</div>
          </div>
          <div>
            {analysis.trend.type ? (
              <div className="text-sm px-2 py-1 rounded bg-yellow-600 text-black">Likely increase in {analysis.trend.type} (confidence {Math.round(analysis.trend.confidence*100)}%)</div>
            ) : (
              <div className="text-sm px-2 py-1 rounded bg-gray-700 text-gray-300">No strong trend</div>
            )}
          </div>
        </div>
      </div>

      <div>
        <div className="flex items-center justify-between mb-2">
          <div className="text-sm font-medium">Top hotspots</div>
          <div className="text-xs text-gray-400">Locations with most recent reports</div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          {analysis.hotspots.map(h => (
            <div key={h.loc} className="p-3 bg-gray-700 rounded flex items-center justify-between">
              <div>
                <div className="font-medium truncate max-w-xs">{h.loc}</div>
                <div className="text-xs text-gray-300">{h.count} reports</div>
              </div>
              <div className="flex flex-col gap-2 ml-4">
                <button onClick={() => handleCleanupLocation(h.loc)} disabled={busyLocation === h.loc} className="px-3 py-1 rounded bg-green-600 text-white text-xs">
                  {busyLocation === h.loc ? 'Cleaning...' : 'Mark cleaned'}
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Samples from hotspots with actions */}
      {hotspotSamples.length > 0 && (
        <div>
          <div className="text-sm font-medium mb-2">Sample reports from hotspots</div>
          <div className="space-y-2">
            {hotspotSamples.map(s => (
              s.sample ? (
                <div key={s.sample.id} className="p-2 bg-gray-800 rounded flex items-center justify-between">
                  <div className="text-sm">
                    <div className="font-medium">{s.sample.type} — {s.sample.location}</div>
                    <div className="text-xs text-gray-400">{s.sample.description || 'No description'}</div>
                  </div>
                  <div className="flex flex-col gap-2 ml-4">
                    <button onClick={() => handleMarkReport(s.sample.id, 'cleaned')} disabled={busyIds.has(s.sample.id)} className="px-3 py-1 rounded bg-green-600 text-white text-xs">
                      {busyIds.has(s.sample.id) ? 'Working...' : 'Mark cleaned'}
                    </button>
                    <button onClick={() => handleMarkReport(s.sample.id, 'resolved')} disabled={busyIds.has(s.sample.id)} className="px-3 py-1 rounded bg-indigo-600 text-white text-xs">
                      {busyIds.has(s.sample.id) ? 'Working...' : 'Mark resolved'}
                    </button>
                  </div>
                </div>
              ) : null
            ))}
          </div>
        </div>
      )}

      <div className="text-xs text-gray-400">Tip: This component uses a lightweight heuristic locally. Replace `onCleanupLocation` or `onMarkReport` with a server/ML call for production-grade predictions.</div>
    </div>
  )
}

export default AiComponent
