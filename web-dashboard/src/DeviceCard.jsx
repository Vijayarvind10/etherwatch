import React, {useEffect, useMemo, useState} from 'react'
import HistoryChart from './HistoryChart'

const STATUS_STYLES = {
  OK: {text: 'OK', bg: '#d4f8d4', border: '#9cd99c', color: '#235123'},
  ALERT: {text: 'ALERT', bg: '#ffd6d6', border: '#ff9a9a', color: '#8c1a1a'},
  OFFLINE: {text: 'OFFLINE', bg: '#ebecf0', border: '#c2c5cc', color: '#495057'},
}

const IFACE_BADGES = {
  OK: {bg: '#e6f4ea', color: '#205522', text: 'OK'},
  ALERT: {bg: '#ffe4c4', color: '#8a3b0b', text: 'ALERT'},
  OFFLINE: {bg: '#f1f3f5', color: '#5f656d', text: 'OFFLINE'},
}

const HISTORY_REFRESH_MS = 10000

function badgeFor(status) {
  return STATUS_STYLES[status] || STATUS_STYLES.OK
}

function ifaceBadge(status) {
  return IFACE_BADGES[status] || IFACE_BADGES.OK
}

function formatMbps(value) {
  if (typeof value !== 'number' || Number.isNaN(value)) return '0.0'
  return (value / 1e6).toFixed(1)
}

export default function DeviceCard({d, controllerOrigin}) {
  const [expanded, setExpanded] = useState(false)
  const [history, setHistory] = useState({})
  const ifaceKey = useMemo(() => (d.ifaces || []).map(ifc => ifc.name).join(','), [d.ifaces])
  const statusBadge = badgeFor(d.status)
  const apiBase = useMemo(() => controllerOrigin.replace(/\/$/, ''), [controllerOrigin])

  useEffect(() => {
    if (!expanded || !ifaceKey) return
    let cancelled = false

    const fetchHistory = async () => {
      if (!d.ifaces) return
      await Promise.all(
        d.ifaces.map(async ifc => {
          try {
            setHistory(prev => ({
              ...prev,
              [ifc.name]: {...prev[ifc.name], loading: true, error: null},
            }))
            const url = `${apiBase}/api/history?device=${encodeURIComponent(d.id)}&iface=${encodeURIComponent(ifc.name)}&minutes=5`
            const res = await fetch(url)
            if (!res.ok) {
              throw new Error(`history request failed (${res.status})`)
            }
            const json = await res.json()
            if (!cancelled) {
              setHistory(prev => ({
                ...prev,
                [ifc.name]: {
                  samples: json.samples || [],
                  loading: false,
                  error: null,
                  fetchedAt: Date.now(),
                },
              }))
            }
          } catch (err) {
            if (!cancelled) {
              setHistory(prev => ({
                ...prev,
                [ifc.name]: {samples: [], loading: false, error: err.message},
              }))
            }
          }
        }),
      )
    }

    fetchHistory()
    const interval = setInterval(fetchHistory, HISTORY_REFRESH_MS)

    return () => {
      cancelled = true
      clearInterval(interval)
    }
  }, [expanded, ifaceKey, apiBase, d.id, d.ifaces])

  return (
    <div style={{border: `1px solid ${statusBadge.border}`, borderRadius: 8, padding: 14, width: 320, background: '#ffffff'}}>
      <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center'}}>
        <div style={{fontSize: 16, fontWeight: 600, color: '#1d1f23'}}>{d.id}</div>
        <div
          style={{
            background: statusBadge.bg,
            color: statusBadge.color,
            padding: '4px 10px',
            borderRadius: 12,
            border: `1px solid ${statusBadge.border}`,
            fontSize: 12,
            fontWeight: 600,
          }}
        >
          {statusBadge.text}
        </div>
      </div>
      {d.status !== 'OK' && (
        <div style={{marginTop: 8, padding: 8, borderRadius: 6, background: '#fff5f5', color: '#8c1a1a', fontSize: 13}}>
          Device reported <strong>{d.status}</strong>. Inspect interface trends below.
        </div>
      )}
      <div style={{marginTop: 10}}>
        {d.ifaces &&
          d.ifaces.map(ifc => {
            const badge = ifaceBadge(ifc.status)
            return (
              <div key={ifc.name} style={{fontSize: 12, marginTop: 8, padding: 8, borderRadius: 6, background: '#f8f9fa'}}>
                <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center'}}>
                  <div style={{fontWeight: 600}}>{ifc.name}</div>
                  <div
                    style={{
                      background: badge.bg,
                      color: badge.color,
                      padding: '2px 8px',
                      borderRadius: 10,
                      fontSize: 11,
                      fontWeight: 600,
                    }}
                  >
                    {badge.text}
                  </div>
                </div>
                <div style={{marginTop: 4, color: '#343a40'}}>
                  <div>
                    rx: {formatMbps(ifc.rx_bps)} Mbps &nbsp; tx: {formatMbps(ifc.tx_bps)} Mbps
                  </div>
                  <div>
                    drops: {ifc.drops} &nbsp; q: {ifc.q} &nbsp; lat: {ifc.lat_ms.toFixed(2)} ms
                  </div>
                </div>
                {expanded && (
                  <div style={{marginTop: 8}}>
                    {history[ifc.name]?.loading && <div style={{fontSize: 12, color: '#666'}}>Loading history…</div>}
                    {history[ifc.name]?.error && (
                      <div style={{fontSize: 12, color: '#c92a2a'}}>History error: {history[ifc.name].error}</div>
                    )}
                    {!history[ifc.name]?.loading && !history[ifc.name]?.error && (
                      <HistoryChart samples={history[ifc.name]?.samples} label={`${ifc.name} last 5 min`} />
                    )}
                  </div>
                )}
              </div>
            )
          })}
      </div>
      {d.ifaces && d.ifaces.length > 0 && (
        <button
          onClick={() => setExpanded(v => !v)}
          style={{
            marginTop: 12,
            fontSize: 12,
            padding: '6px 10px',
            borderRadius: 6,
            border: '1px solid #ced4da',
            background: expanded ? '#f1f3f5' : '#ffffff',
          }}
        >
          {expanded ? 'Hide history' : 'Show history'}
        </button>
      )}
    </div>
  )
}
