import React, {useEffect, useMemo, useState} from 'react'
import HistoryChart from './HistoryChart'

export default function DeviceModal({device, controllerOrigin, open, onClose, demoMode}) {
  const [history, setHistory] = useState({})
  const [loading, setLoading] = useState(false)

  useEffect(()=>{
    if (!open || !device || demoMode) {
      setHistory({})
      return
    }
    let aborted = false
    const load = async ()=>{
      setLoading(true)
      try{
        const results = await Promise.all(
          (device.ifaces || []).map(async ifc=>{
            const url = `${controllerOrigin.replace(/\/$/, '')}/api/history?device=${encodeURIComponent(device.id)}&iface=${encodeURIComponent(ifc.name)}&minutes=10`
            const res = await fetch(url)
            if (!res.ok) throw new Error(`history fetch failed ${res.status}`)
            const json = await res.json()
            return [ifc.name, json.samples || []]
          })
        )
        if (!aborted){
          const map = {}
          results.forEach(([iface, samples])=>{
            map[iface] = samples
          })
          setHistory(map)
        }
      }catch(err){
        console.error(err)
      }finally{
        if (!aborted) setLoading(false)
      }
    }
    load()
    return ()=> {aborted = true}
  }, [open, device, controllerOrigin, demoMode])

  const aggregate = useMemo(()=>{
    if (!device?.ifaces) return {rx:0, tx:0, drops:0, avgLat:0}
    const totals = device.ifaces.reduce((acc, ifc)=>{
      acc.rx += ifc.rx_bps || 0
      acc.tx += ifc.tx_bps || 0
      acc.drops += ifc.drops || 0
      acc.lat += ifc.lat_ms || 0
      return acc
    }, {rx:0, tx:0, drops:0, lat:0})
    return {
      rx: totals.rx,
      tx: totals.tx,
      drops: totals.drops,
      avgLat: device.ifaces.length ? totals.lat / device.ifaces.length : 0,
    }
  }, [device])

  if (!open || !device) return null

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" onClick={e=> e.stopPropagation()}>
        <header className="modal__header">
          <div>
            <span>Device</span>
            <h3>{device.id}</h3>
          </div>
          <button className="modal__close" onClick={onClose}>×</button>
        </header>

        <section className="modal__overview">
          <div className="modal__stat">
            <span>Total Rx</span>
            <strong>{formatGbps(aggregate.rx)} Gbps</strong>
          </div>
          <div className="modal__stat">
            <span>Total Tx</span>
            <strong>{formatGbps(aggregate.tx)} Gbps</strong>
          </div>
          <div className="modal__stat">
            <span>Frame drops</span>
            <strong>{aggregate.drops}</strong>
          </div>
          <div className="modal__stat">
            <span>Avg latency</span>
            <strong>{aggregate.avgLat.toFixed(2)} ms</strong>
          </div>
        </section>

        <section className="modal__body">
          {demoMode && (
            <div className="modal__empty">
              History charts are disabled while demo mode is active. Reconnect to the controller to view live streams.
            </div>
          )}
          {!demoMode && loading && (
            <div className="modal__empty">Loading interface history…</div>
          )}
          {!demoMode && !loading && device.ifaces?.map(ifc=> (
            <div key={ifc.name} className="modal__iface">
              <div className="modal__iface-head">
                <h4>{ifc.name}</h4>
                <span className={`badge badge--${(ifc.status || 'OK').toLowerCase()}`}>{ifc.status || 'OK'}</span>
              </div>
              <div className="modal__iface-stats">
                <span>rx {formatGbps(ifc.rx_bps)} Gbps</span>
                <span>tx {formatGbps(ifc.tx_bps)} Gbps</span>
                <span>dropped {ifc.drops}</span>
                <span>queue {ifc.q}</span>
                <span>latency {ifc.lat_ms?.toFixed(2)} ms</span>
              </div>
              {history[ifc.name]?.length
                ? <HistoryChart samples={history[ifc.name]} label={`${ifc.name} · last 10 min`} />
                : <div className="modal__empty">No samples yet.</div>}
            </div>
          ))}
        </section>
      </div>
    </div>
  )
}

function formatGbps(bps){
  if (!bps) return '0.00'
  return (bps / 1e9).toFixed(2)
}
