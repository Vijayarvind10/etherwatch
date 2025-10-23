import React, {useEffect, useMemo, useRef, useState} from 'react'
import {createRoot} from 'react-dom/client'
import {connectWS, inferHttpOrigin} from './ws'
import DeviceCard from './DeviceCard'
import PacketFlowAnimation from './PacketFlowAnimation'
import DemoControlPanel from './DemoControlPanel'
import TimelineChart from './TimelineChart'
import './styles.css'

const STATUS_FILTERS = ['ALL', 'OK', 'ALERT', 'OFFLINE']
const MAX_TIMELINE_POINTS = 30

function App(){
  const [state, setState] = useState({t:0, devices:[]})
  const [demoMode, setDemoMode] = useState(false)
  const [demoScenario, setDemoScenario] = useState('healthy')
  const [panelOpen, setPanelOpen] = useState(false)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('ALL')
  const [timeline, setTimeline] = useState([])
  const [connectionStatus, setConnectionStatus] = useState('connecting')
  const [messageCount, setMessageCount] = useState(0)

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
        acc.drops += ifc.drops || 0
      })
      return acc
    }, {rx:0, tx:0, ifaces:0, drops:0})
  }, [devices])

  const demoTimerRef = useRef(null)
  const receivedRealData = useRef(false)
  const wsRef = useRef(null)

  useEffect(()=>{
    const ws = connectWS('/ws')
    wsRef.current = ws
    ws.onopen = () => {
      setConnectionStatus(receivedRealData.current ? 'live' : 'connected')
      if (demoMode && !receivedRealData.current) {
        startDemo(demoScenario, true)
      } else if (demoMode) {
        stopDemo()
      }
    }
    ws.onmessage = ev => {
      try{
        const msg = JSON.parse(ev.data)
        setState(msg)
        setMessageCount(count => count + 1)
        receivedRealData.current = true
        setConnectionStatus('live')
        if (demoMode) {
          stopDemo()
        }
      }catch(err){
        console.error(err)
      }
    }
    const activateDemo = ()=>{
      if (!receivedRealData.current) {
        startDemo(demoScenario, true)
      }
    }
    ws.onerror = () => {
      setConnectionStatus('demo')
      activateDemo()
    }
    ws.onclose = () => {
      setConnectionStatus('demo')
      activateDemo()
    }
    return ()=>{
      ws.close()
      stopDemo()
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [demoScenario])

  useEffect(()=>{
    if (!devices.length) return
    const point = {
      t: Date.now(),
      rx: totals.rx,
      tx: totals.tx,
      drops: totals.drops,
    }
    setTimeline(prev=>{
      const next = [...prev, point]
      if (next.length > MAX_TIMELINE_POINTS) next.shift()
      return next
    })
  }, [devices, totals.rx, totals.tx, totals.drops])

  const formatGbps = bps => (bps ? (bps / 1e9).toFixed(2) : '0.0')

  const startDemo = (scenario, fromFallback = false)=>{
    if (demoTimerRef.current) clearInterval(demoTimerRef.current)
    setDemoMode(true)
    if (!fromFallback) setConnectionStatus('demo')
    const base = createScenarioSnapshot(scenario)
    setState(base)
    demoTimerRef.current = setInterval(()=>{
      setState(prev => mutateScenarioSnapshot(prev, scenario))
    }, 1600)
  }

  const stopDemo = ()=>{
    if (demoTimerRef.current){
      clearInterval(demoTimerRef.current)
      demoTimerRef.current = null
    }
    setDemoMode(false)
    setConnectionStatus(receivedRealData.current ? 'live' : 'connected')
  }

  const handleScenarioSelect = scenario=>{
    setDemoScenario(scenario)
    startDemo(scenario)
  }

  const handleCustomDemo = payload=>{
    setState(createCustomDemoSnapshot(payload))
    setDemoMode(true)
    setConnectionStatus('demo')
    if (demoTimerRef.current) clearInterval(demoTimerRef.current)
  }

  const filteredDevices = useMemo(()=>{
    return devices.filter(device=>{
      const matchSearch = device.id.toLowerCase().includes(search.toLowerCase())
      const matchStatus = statusFilter === 'ALL' || device.status === statusFilter
      return matchSearch && matchStatus
    })
  }, [devices, search, statusFilter])

  return (
    <div className="app-root">
      <nav className="top-nav">
        <div className="top-nav__brand">EtherWatch<span>demo</span></div>
        <div className={`top-nav__status status--${connectionStatus}`}>
          <span className="status-dot" />
          {statusLabel(connectionStatus, messageCount)}
        </div>
        <div className="top-nav__links">
          <a href="https://github.com/Vijayarvind10/etherwatch" target="_blank" rel="noreferrer">GitHub</a>
          <a href="http://localhost:9090/metrics" target="_blank" rel="noreferrer">Metrics</a>
        </div>
      </nav>

      <DemoControlPanel
        open={panelOpen}
        onClose={()=> setPanelOpen(false)}
        demoMode={demoMode}
        scenario={demoScenario}
        onScenarioSelect={handleScenarioSelect}
        onToggleDemo={()=> demoMode ? stopDemo() : startDemo(demoScenario)}
        onApplyCustom={handleCustomDemo}
      />

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
                <strong style={{color:'var(--accent)'}}>{demoScenario}</strong>
              </div>
            )}
          </div>
          <div className="hero-actions">
            <button className="hero-action-btn" onClick={()=> setPanelOpen(true)}>
              Open demo controls
            </button>
            {demoMode ? (
              <button className="hero-action-btn secondary" onClick={stopDemo}>
                Resume live feed
              </button>
            ) : (
              <button className="hero-action-btn secondary" onClick={()=> startDemo(demoScenario)}>
                Start fallback demo
              </button>
            )}
          </div>
        </div>
        <PacketFlowAnimation />
      </header>

      <TimelineChart data={timeline} />

      <section className="device-board">
        <div className="board-header">
          <h2>Fabric devices</h2>
          <div className="board-meta">
            Last update · {lastUpdate} · Offline: {offline.length}
          </div>
        </div>
        <div className="board-controls">
          <input
            type="search"
            className="board-search"
            placeholder="Search device..."
            value={search}
            onChange={e=> setSearch(e.target.value)}
          />
          <select className="board-filter" value={statusFilter} onChange={e=> setStatusFilter(e.target.value)}>
            {STATUS_FILTERS.map(opt=> (
              <option key={opt} value={opt}>{opt}</option>
            ))}
          </select>
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
          {filteredDevices.map(d=> (
            <DeviceCard key={d.id} d={d} controllerOrigin={controllerOrigin} demoMode={demoMode} />
          ))}
        </div>
        {filteredDevices.length === 0 && (
          <div className="empty-state">
            No devices match your filters. {demoMode ? 'Adjust the scenario or filters to see synthetic telemetry.' : 'Start an agent to begin streaming telemetry.'}
          </div>
        )}
      </section>
      <footer className="app-footer">
        © {new Date().getFullYear()} Vijay Arvind Ramamoorthy
      </footer>
    </div>
  )
}

function createScenarioSnapshot(scenario){
  const now = Date.now()
  switch (scenario) {
  case 'latency-spike':
    return {
      t: now,
      devices: [
        makeDevice('core-nyc', 'ALERT', [
          makeIface('xe-0/0/1', 1.4, 1.2, 14, 28, 18.0, 'ALERT'),
          makeIface('xe-0/0/2', 1.1, 0.9, 6, 12, 16.2),
        ]),
        makeDevice('agg-sfo', 'OK', [
          makeIface('et-1/0/49', 0.8, 0.82, 1, 3, 1.1),
          makeIface('et-1/0/50', 0.83, 0.81, 0, 2, 0.9),
        ]),
        makeDevice('leaf-chi', 'OK', [
          makeIface('eth9', 0.52, 0.50, 0, 1, 1.0),
        ]),
      ],
    }
  case 'high-drops':
    return {
      t: now,
      devices: [
        makeDevice('fabric-sw1', 'ALERT', [
          makeIface('uplink-a', 0.9, 0.85, 220, 24, 6.4, 'ALERT'),
          makeIface('uplink-b', 0.88, 0.82, 198, 22, 5.9, 'ALERT'),
        ]),
        makeDevice('edge-gw', 'OK', [
          makeIface('wan1', 0.61, 0.57, 8, 4, 2.1),
          makeIface('wan2', 0.59, 0.55, 5, 3, 1.9),
        ]),
        makeDevice('lab-appliance', 'OFFLINE', [
          makeIface('eth0', 0, 0, 0, 0, 0, 'OFFLINE'),
        ]),
      ],
    }
  case 'healthy':
  default:
    return {
      t: now,
      devices: [
        makeDevice('spine-01', 'OK', [
          makeIface('ethernet1', 1.2, 0.8, 3, 2, 0.8),
          makeIface('ethernet2', 1.05, 0.88, 0, 1, 0.7),
        ]),
        makeDevice('leaf-11', 'OK', [
          makeIface('uplink1', 0.6, 0.55, 2, 2, 0.9),
          makeIface('uplink2', 0.58, 0.6, 0, 3, 0.9),
        ]),
        makeDevice('leaf-24', 'OK', [
          makeIface('ethernet5', 0.44, 0.41, 1, 1, 1.1),
        ]),
      ],
    }
  }
}

function mutateScenarioSnapshot(prev, scenario){
  const clone = JSON.parse(JSON.stringify(prev || createScenarioSnapshot(scenario)))
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
      const jitter = (Math.random()-0.5) * 0.18
      ifc.rx_bps = Math.max(0, ifc.rx_bps + jitter * 1e9)
      ifc.tx_bps = Math.max(0, ifc.tx_bps + jitter * 0.95e9)
      if (scenario === 'high-drops' || ifc.status === 'ALERT') {
        ifc.drops = Math.round(80 + Math.random()*160)
        ifc.q = Math.round(18 + Math.random()*16)
        ifc.lat_ms = Number((4 + Math.random()*8).toFixed(2))
        device.status = 'ALERT'
      } else if (scenario === 'latency-spike') {
        ifc.drops = Math.round(Math.random()*8)
        ifc.q = Math.round(10 + Math.random()*12)
        ifc.lat_ms = Number((10 + Math.random()*12).toFixed(2))
        device.status = 'ALERT'
      } else {
        ifc.drops = Math.round(Math.random()*4)
        ifc.q = Math.round(Math.random()*5)
        ifc.lat_ms = Number((0.6 + Math.random()*1.4).toFixed(2))
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

function createCustomDemoSnapshot({deviceId='custom-node', rxGbps=1, txGbps=0.8, drops=10, latencyMs=2, status='OK'}){
  const now = Date.now()
  return {
    t: now,
    devices: [
      makeDevice(deviceId, status, [
        makeIface('custom-if0', rxGbps, txGbps, drops, Math.max(0, Math.round(drops / 12)), latencyMs, status),
      ]),
    ],
  }
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

function statusLabel(status, messages){
  switch (status) {
  case 'live':
    return messages ? `Live telemetry · ${messages} samples` : 'Live telemetry'
  case 'connected':
    return 'Connected · waiting for samples'
  case 'demo':
    return 'Demo stream active'
  default:
    return 'Connecting…'
  }
}

createRoot(document.getElementById('root')).render(<App />)
