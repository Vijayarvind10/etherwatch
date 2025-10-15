import React, {useEffect, useMemo, useState} from 'react'
import HistoryChart from './HistoryChart'

const STATUS_STYLES = {
  OK: 'badge--ok',
  ALERT: 'badge--alert',
  OFFLINE: 'badge--offline',
}

export default function DeviceCard({d, controllerOrigin, demoMode}){
  const [expanded, setExpanded] = useState(false)
  const [history, setHistory] = useState({})
  const ifaceKey = useMemo(()=> (d.ifaces || []).map(ifc => ifc.name).join(','), [d.ifaces])

  const aggregates = useMemo(()=>{
    return d.ifaces?.reduce((acc, ifc)=>{
      acc.rx += ifc.rx_bps || 0
      acc.tx += ifc.tx_bps || 0
      acc.drops += ifc.drops || 0
      acc.lat += ifc.lat_ms || 0
      return acc
    }, {rx:0, tx:0, drops:0, lat:0, count:d.ifaces?.length || 0}) ?? {rx:0, tx:0, drops:0, lat:0, count:0}
  }, [d.ifaces])

  const avgLatency = aggregates.count ? aggregates.lat / aggregates.count : 0

  useEffect(()=>{
    if (demoMode) return
    if (!expanded || !ifaceKey) return
    let cancelled = false

    const fetchHistory = async () => {
      if (!d.ifaces) return
      await Promise.all(d.ifaces.map(async ifc => {
        try{
          setHistory(prev => ({...prev, [ifc.name]: {...prev[ifc.name], loading: true, error: null}}))
          const url = `${controllerOrigin.replace(/\/$/, '')}/api/history?device=${encodeURIComponent(d.id)}&iface=${encodeURIComponent(ifc.name)}&minutes=5`
          const res = await fetch(url)
          if (!res.ok) throw new Error(`history request failed (${res.status})`)
          const json = await res.json()
          if (!cancelled){
            setHistory(prev => ({
              ...prev,
              [ifc.name]: {
                samples: json.samples || [],
                loading: false,
                error: null,
              },
            }))
          }
        }catch(err){
          if (!cancelled){
            setHistory(prev => ({
              ...prev,
              [ifc.name]: {samples: [], loading: false, error: err.message},
            }))
          }
        }
      }))
    }

    fetchHistory()
    const interval = setInterval(fetchHistory, 10000)
    return ()=> {
      cancelled = true
      clearInterval(interval)
    }
  }, [expanded, ifaceKey, controllerOrigin, d.id, d.ifaces, demoMode])

  const formatMbps = val => (val / 1e6).toFixed(1)
  const badgeClass = STATUS_STYLES[d.status] || STATUS_STYLES.OK

  return (
    <div className="device-card">
      <div className="device-card__head">
        <div className="device-card__title">
          <span>Device</span>
          <strong>{d.id}</strong>
        </div>
        <div className={`device-card__badge ${badgeClass}`}>
          {d.status || 'OK'}
        </div>
      </div>

      <div className="device-card__metrics">
        <div className="metric-block">
          <span>Total Rx</span>
          <strong>{formatMbps(aggregates.rx)} Mbps</strong>
        </div>
        <div className="metric-block">
          <span>Total Tx</span>
          <strong>{formatMbps(aggregates.tx)} Mbps</strong>
        </div>
        <div className="metric-block">
          <span>Frame drops</span>
          <strong>{aggregates.drops}</strong>
        </div>
        <div className="metric-block">
          <span>Avg latency</span>
          <strong>{avgLatency.toFixed(2)} ms</strong>
        </div>
      </div>

      <div className="iface-list">
        {d.ifaces && d.ifaces.map(ifc => (
          <div key={ifc.name} className="iface-row">
            <div className="iface-row__header">
              <h4>{ifc.name}</h4>
              <div className="iface-row__badge">{ifc.status || 'OK'}</div>
            </div>
            <div className="iface-row__stats">
              <div>rx · {formatMbps(ifc.rx_bps)} Mbps</div>
              <div>tx · {formatMbps(ifc.tx_bps)} Mbps</div>
              <div>drops · {ifc.drops}</div>
              <div>queue · {ifc.q}</div>
              <div>latency · {ifc.lat_ms?.toFixed(2)} ms</div>
            </div>
            {expanded && !demoMode && (
              <div className="history-chart">
                {history[ifc.name]?.loading && <div className="history-chart__label">Loading history…</div>}
                {history[ifc.name]?.error && <div className="history-chart__label" style={{color:'var(--alert)'}}>History error: {history[ifc.name].error}</div>}
                {!history[ifc.name]?.loading && !history[ifc.name]?.error && (
                  <HistoryChart samples={history[ifc.name]?.samples} label={`${ifc.name} · last 5 min`} />
                )}
              </div>
            )}
            {expanded && demoMode && (
              <div className="history-chart__label" style={{color:'var(--text-secondary)'}}>
                History trails are disabled in demo mode.
              </div>
            )}
          </div>
        ))}
      </div>

      {d.ifaces && d.ifaces.length > 0 && (
        <button className="device-card__toggle" onClick={()=> setExpanded(v => !v)}>
          {expanded ? 'Hide history' : demoMode ? 'Show demo info' : 'Show history'}
        </button>
      )}
    </div>
  )
}
