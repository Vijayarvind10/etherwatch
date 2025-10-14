import React, {useEffect, useMemo, useState} from 'react'
import {createRoot} from 'react-dom/client'
import {connectWS, inferHttpOrigin} from './ws'
import DeviceCard from './DeviceCard'
import PacketFlowAnimation from './PacketFlowAnimation'
import './styles.css'

function App(){
  const [state, setState] = useState({t:0, devices:[]})
  const controllerOrigin = useMemo(()=> inferHttpOrigin(), [])
  const devices = state.devices ?? []
  const alerts = useMemo(()=> devices.filter(d => d.status && d.status !== 'OK'), [devices])
  const offline = useMemo(()=> devices.filter(d => d.status === 'OFFLINE'), [devices])
  const lastUpdate = state.t ? new Date(state.t).toLocaleTimeString() : '—'

  const totals = useMemo(()=>{
    return devices.reduce((acc, device)=>{
      device.ifaces?.forEach(ifc=>{
        acc.rx += ifc.rx_bps || 0
        acc.tx += ifc.tx_bps || 0
        acc.ifaces += 1
      })
      return acc
    }, {rx:0, tx:0, ifaces:0})
  }, [devices])

  useEffect(()=>{
    const ws = connectWS('/ws')
    ws.onmessage = (ev)=>{
      try{
        const msg = JSON.parse(ev.data)
        setState(msg)
      }catch(e){ console.error(e) }
    }
    return ()=> ws.close()
  },[])

  const formatGbps = (bps)=>{
    if (!bps) return '0.0'
    return (bps / 1e9).toFixed(2)
  }

  return (
    <div className="app-root">
      <header className="hero">
        <div className="hero-copy">
          <span className="hero-tag">EtherWatch · Crafted for Arista</span>
          <h1>Live packets. Real-time intuition.</h1>
          <p>
            Vijay’s personalized EtherWatch cockpit: anomaly detection, streaming telemetry, and history-aware insights
            designed to resonate with Arista engineers.
          </p>
          <div className="hero-summary">
            <div className="summary-card">
              <span>Devices online</span>
              <strong>{devices.length}</strong>
            </div>
            <div className="summary-card">
              <span>Alerts glowing</span>
              <strong style={{color: alerts.length ? 'var(--alert)' : 'var(--ok)'}}>
                {alerts.length}
              </strong>
            </div>
            <div className="summary-card">
              <span>Interfaces streaming</span>
              <strong>{totals.ifaces}</strong>
            </div>
            <div className="summary-card">
              <span>Aggregate throughput</span>
              <strong>{formatGbps(totals.rx + totals.tx)} Gbps</strong>
            </div>
          </div>
        </div>
        <PacketFlowAnimation />
      </header>

      <section className="device-board">
        <div className="board-header">
          <h2>Fabric devices</h2>
          <div className="board-meta">
            Last update · {lastUpdate} · Offline: {offline.length}
          </div>
        </div>
        {alerts.length > 0 && (
          <div className="summary-card" style={{borderRadius:'16px', background:'rgba(255, 107, 107, 0.08)', border:'1px solid rgba(255, 107, 107, 0.25)'}}>
            <span style={{color:'rgba(255, 255, 255, 0.6)'}}>Attention</span>
            <strong style={{color:'var(--alert)'}}>
              {alerts.map((d, idx)=> `${idx ? ' · ' : ''}${d.id} (${d.status})`).join('')}
            </strong>
          </div>
        )}
        <div className="device-grid">
          {devices.map(d=> (
            <DeviceCard key={d.id} d={d} controllerOrigin={controllerOrigin} />
          ))}
        </div>
        {devices.length === 0 && (
          <div className="empty-state">
            Waiting for telemetry… start an agent with <code>go run . --controller 127.0.0.1:9000</code>.
          </div>
        )}
      </section>
    </div>
  )
}

createRoot(document.getElementById('root')).render(<App />)
