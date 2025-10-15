import React, {useEffect, useMemo, useRef, useState} from 'react'
import {createRoot} from 'react-dom/client'
import {connectWS, inferHttpOrigin} from './ws'
import DeviceCard from './DeviceCard'
import PacketFlowAnimation from './PacketFlowAnimation'
import './styles.css'

function App(){
  const [state, setState] = useState({t:0, devices:[]})
  const [demoMode, setDemoMode] = useState(false)
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

  const demoTimerRef = useRef(null)
  const receivedRealData = useRef(false)

  useEffect(()=>{
    const ws = connectWS('/ws')
    ws.onmessage = (ev)=>{
      try{
        const msg = JSON.parse(ev.data)
        setState(msg)
        receivedRealData.current = true
        if (demoMode) stopDemo()
      }catch(e){ console.error(e) }
    }
    ws.onopen = ()=> {
      if (demoMode) stopDemo()
    }
    const activateDemo = ()=>{
      if (!receivedRealData.current) startDemo()
    }
    ws.onerror = activateDemo
    ws.onclose = activateDemo
    return ()=> {
      ws.close()
      stopDemo()
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [demoMode])

  const formatGbps = (bps)=>{
    if (!bps) return '0.0'
    return (bps / 1e9).toFixed(2)
  }

  const startDemo = ()=>{
    if (demoTimerRef.current) return
    setDemoMode(true)
    const base = createDemoSnapshot()
    setState(base)
    demoTimerRef.current = setInterval(()=>{
      setState(prev => mutateDemoSnapshot(prev))
    }, 1600)
  }

  const stopDemo = ()=>{
    setDemoMode(false)
    if (demoTimerRef.current){
      clearInterval(demoTimerRef.current)
      demoTimerRef.current = null
    }
  }

  return (
    <div className="app-root">
      <header className="hero">
        <div className="hero-copy">
          <span className="hero-tag">EtherWatch · Live Telemetry</span>
          <h1>Live packets. Real-time intuition.</h1>
          <p>
            A compact EtherWatch cockpit that highlights anomaly detection, streaming telemetry, and history-aware insights
            for busy network engineers.
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
            {demoMode && (
              <div className="summary-card" style={{border:'1px solid rgba(65,209,255,0.35)', background:'var(--accent-soft)'}}>
                <span>Demo mode</span>
                <strong style={{color:'var(--accent)'}}>Synthetic stream</strong>
              </div>
            )}
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
            <DeviceCard key={d.id} d={d} controllerOrigin={controllerOrigin} demoMode={demoMode} />
          ))}
        </div>
        {devices.length === 0 && (
          <div className="empty-state">
            Waiting for telemetry… start an agent with <code>go run . --controller 127.0.0.1:9000</code>.
          </div>
        )}
      </section>
      <footer className="app-footer">
        © {new Date().getFullYear()} Vijay Arvind Ramamoorthy
      </footer>
    </div>
  )
}

function createDemoSnapshot(){
  const now = Date.now()
  return {
    t: now,
    devices: [
      makeDevice('spine-01', 'OK', [
        makeIface('ethernet1', 1.2, 0.8, 3, 2, 0.8),
        makeIface('ethernet2', 1.05, 0.88, 0, 1, 0.7),
      ]),
      makeDevice('leaf-11', 'ALERT', [
        makeIface('uplink1', 0.6, 0.55, 120, 24, 6.2, 'ALERT'),
        makeIface('uplink2', 0.58, 0.6, 0, 3, 0.9),
      ]),
      makeDevice('leaf-24', 'OFFLINE', [
        makeIface('ethernet5', 0, 0, 0, 0, 0, 'OFFLINE'),
      ]),
    ],
  }
}

function mutateDemoSnapshot(prev){
  const clone = JSON.parse(JSON.stringify(prev || createDemoSnapshot()))
  clone.t = Date.now()
  clone.devices.forEach(device=>{
    device.ifaces?.forEach(ifc=>{
      if (ifc.status === 'OFFLINE') {
        ifc.rx_bps = 0
        ifc.tx_bps = 0
        ifc.drops = 0
        ifc.q = 0
        ifc.lat_ms = 0
        return
      }
      const jitter = (Math.random()-0.5) * 0.15
      ifc.rx_bps = Math.max(0, ifc.rx_bps + jitter * 1e9)
      ifc.tx_bps = Math.max(0, ifc.tx_bps + jitter * 0.9e9)
      if (ifc.status === 'ALERT' || Math.random() < 0.1){
        ifc.drops = Math.round(80 + Math.random()*140)
        ifc.q = Math.round(20 + Math.random()*12)
        ifc.lat_ms = Number((4 + Math.random()*8).toFixed(2))
        device.status = 'ALERT'
      } else {
        ifc.drops = Math.round(Math.random()*6)
        ifc.q = Math.round(Math.random()*6)
        ifc.lat_ms = Number((0.6 + Math.random()*1.2).toFixed(2))
      }
    })
    if (device.ifaces?.every(ifc => ifc.status === 'OFFLINE')) {
      device.status = 'OFFLINE'
    } else if (device.status !== 'ALERT') {
      device.status = 'OK'
    }
  })
  return clone
}

function makeDevice(id, status, ifaces){
  return {id, status, ifaces}
}

function makeIface(name, rxGbps, txGbps, drops, q, latMs, status='OK'){
  return {
    name,
    rx_bps: rxGbps * 1e9,
    tx_bps: txGbps * 1e9,
    drops,
    q,
    lat_ms: latMs,
    status,
  }
}

createRoot(document.getElementById('root')).render(<App />)
