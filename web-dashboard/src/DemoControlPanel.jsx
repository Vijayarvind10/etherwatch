import React, {useMemo, useState} from 'react'

const SCENARIO_OPTIONS = [
  {id: 'healthy', label: 'Healthy Fabric'},
  {id: 'latency-spike', label: 'Latency Spike'},
  {id: 'high-drops', label: 'High Drops'},
]

export default function DemoControlPanel({open, onClose, demoMode, scenario, onScenarioSelect, onToggleDemo, onApplyCustom}){
  const [customDevice, setCustomDevice] = useState('demo-edge')
  const [customRx, setCustomRx] = useState(1.0)
  const [customTx, setCustomTx] = useState(0.8)
  const [customDrops, setCustomDrops] = useState(12)
  const [customLatency, setCustomLatency] = useState(2.5)
  const [customStatus, setCustomStatus] = useState('ALERT')

  const rootClass = useMemo(()=> `demo-panel ${open ? 'open' : ''}`, [open])

  return (
    <aside className={rootClass}>
      <div className="demo-panel__header">
        <h3>Demo Control Panel</h3>
        <button className="demo-panel__close" onClick={onClose}>×</button>
      </div>
      <div className="demo-panel__section">
        <h4>Quick scenarios</h4>
        <div className="demo-panel__scenario-buttons">
          {SCENARIO_OPTIONS.map(opt=> (
            <button
              key={opt.id}
              className={`demo-panel__scenario ${scenario === opt.id ? 'active' : ''}`}
              onClick={()=> onScenarioSelect(opt.id)}
            >
              {opt.label}
            </button>
          ))}
        </div>
        <button className="demo-panel__toggle" onClick={onToggleDemo}>
          {demoMode ? 'Back to live data' : 'Run selected scenario'}
        </button>
      </div>

      <div className="demo-panel__section">
        <h4>Create custom snapshot</h4>
        <label className="demo-panel__field">
          <span>Device ID</span>
          <input value={customDevice} onChange={e=> setCustomDevice(e.target.value)} />
        </label>
        <label className="demo-panel__field">
          <span>Rx Gbps</span>
          <input type="number" step="0.1" value={customRx} onChange={e=> setCustomRx(Number(e.target.value))} />
        </label>
        <label className="demo-panel__field">
          <span>Tx Gbps</span>
          <input type="number" step="0.1" value={customTx} onChange={e=> setCustomTx(Number(e.target.value))} />
        </label>
        <label className="demo-panel__field">
          <span>Drops</span>
          <input type="number" step="1" value={customDrops} onChange={e=> setCustomDrops(Number(e.target.value))} />
        </label>
        <label className="demo-panel__field">
          <span>Latency (ms)</span>
          <input type="number" step="0.1" value={customLatency} onChange={e=> setCustomLatency(Number(e.target.value))} />
        </label>
        <label className="demo-panel__field">
          <span>Status</span>
          <select value={customStatus} onChange={e=> setCustomStatus(e.target.value)}>
            <option value="OK">OK</option>
            <option value="ALERT">ALERT</option>
            <option value="OFFLINE">OFFLINE</option>
          </select>
        </label>
        <button
          className="demo-panel__apply"
          onClick={()=> onApplyCustom({
            deviceId: customDevice || 'demo-edge',
            rxGbps: customRx,
            txGbps: customTx,
            drops: customDrops,
            latencyMs: customLatency,
            status: customStatus,
          })}
        >
          Apply custom snapshot
        </button>
        <p className="demo-panel__hint">
          Custom snapshots freeze the view using your inputs. Use “Back to live data” to reconnect to real telemetry.
        </p>
      </div>
    </aside>
  )
}
