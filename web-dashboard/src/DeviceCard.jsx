import React, {useEffect, useMemo, useState} from 'react'
import HistoryChart from './HistoryChart'

const STATUS_CLASS = { OK: 'status-ok', ALERT: 'status-alert', OFFLINE: 'status-offline' }
const BADGE_CLASS  = { OK: 'badge--ok',  ALERT: 'badge--alert',  OFFLINE: 'badge--offline' }

export default function DeviceCard({d, controllerOrigin, demoMode, onOpenDetails}){
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
              [ifc.name]: { samples: json.samples || [], loading: false, error: null },
            }))
          }
        }catch(err){
          if (!cancelled){
            setHistory(prev => ({...prev, [ifc.name]: {samples:[], loading:false, error:err.message}}))
          }
        }
      }))
    }

    fetchHistory()
    const interval = setInterval(fetchHistory, 10000)
    return ()=>{ cancelled = true; clearInterval(interval) }
  }, [expanded, ifaceKey, controllerOrigin, d.id, d.ifaces, demoMode])

  const fmtGbps = val => val ? (val/1e9).toFixed(3) : '0.000'
  const statusKey = d.status || 'OK'
  const cardClass = `device-card ${STATUS_CLASS[statusKey] || ''}`
  const badgeClass = `device-card__badge ${BADGE_CLASS[statusKey] || BADGE_CLASS.OK}`

  return (
    <div className={cardClass}>
      <div className="device-card__head">
        <div className="device-card__title">
          <strong>{d.id}</strong>
          <span>{aggregates.count} interface{aggregates.count !== 1 ? 's' : ''}</span>
        </div>
        <div className={badgeClass}>
          <span className="badge-dot" />
          {statusKey}
        </div>
      </div>

      <div className="device-card__metrics">
        <div className="metric-block">
          <span>Rx</span>
          <strong>{fmtGbps(aggregates.rx)} Gbps</strong>
        </div>
        <div className="metric-block">
          <span>Tx</span>
          <strong>{fmtGbps(aggregates.tx)} Gbps</strong>
        </div>
        <div className="metric-block">
          <span>Drops</span>
          <strong style={aggregates.drops > 0 ? {color:'var(--danger)'} : {}}>{aggregates.drops}</strong>
        </div>
        <div className="metric-block">
          <span>Avg lat</span>
          <strong style={avgLatency > 5 ? {color:'var(--danger)'} : avgLatency > 2 ? {color:'var(--warning)'} : {}}>
            {avgLatency.toFixed(2)} ms
          </strong>
        </div>
      </div>

      <div className="iface-list">
        {d.ifaces && d.ifaces.map(ifc => {
          const ifcStatus = ifc.status || 'OK'
          return (
            <div key={ifc.name} className="iface-row">
              <div className="iface-row__header">
                <h4>{ifc.name}</h4>
                <div className="iface-row__badge" style={{color: ifcStatus === 'ALERT' ? 'var(--danger)' : ifcStatus === 'OFFLINE' ? 'var(--muted)' : 'var(--ok)'}}>
                  {ifcStatus}
                </div>
              </div>
              <div className="iface-row__stats">
                <span>↑ {fmtGbps(ifc.rx_bps)} Gbps</span>
                <span>↓ {fmtGbps(ifc.tx_bps)} Gbps</span>
                <span>drops {ifc.drops}</span>
                <span>q {ifc.q}</span>
                <span>lat {ifc.lat_ms?.toFixed(2)} ms</span>
              </div>
              {expanded && !demoMode && (
                <div className="history-chart">
                  {history[ifc.name]?.loading && <div className="history-chart__label">Loading…</div>}
                  {history[ifc.name]?.error && (
                    <div className="history-chart__label" style={{color:'var(--danger)'}}>
                      {history[ifc.name].error}
                    </div>
                  )}
                  {!history[ifc.name]?.loading && !history[ifc.name]?.error && (
                    <HistoryChart samples={history[ifc.name]?.samples} label={`${ifc.name} · last 5 min`} />
                  )}
                </div>
              )}
              {expanded && demoMode && (
                <div className="history-chart__label" style={{color:'var(--text-3)'}}>
                  History disabled in dev mode
                </div>
              )}
            </div>
          )
        })}
      </div>

      <div className="device-card__actions">
        {d.ifaces && d.ifaces.length > 0 && (
          <button className="device-card__toggle" onClick={()=> setExpanded(v => !v)}>
            {expanded ? 'Hide history' : 'Show history'}
          </button>
        )}
        <button className="device-card__details" onClick={()=> onOpenDetails?.(d)}>
          View details →
        </button>
      </div>
    </div>
  )
}
