import React from 'react'

const W = 280
const H = 64

function points(samples, key) {
  if (!samples || samples.length < 2) return ''
  const values = samples.map(s => Number(s[key] ?? 0))
  let min = Math.min(...values)
  let max = Math.max(...values)
  if (!isFinite(min) || !isFinite(max)) return ''
  if (min === max) min = 0
  const range = max - min || 1
  return values.map((v, i) => {
    const x = (i / (values.length - 1)) * W
    const y = H - ((v - min) / range) * (H - 4) - 2
    return `${x.toFixed(1)},${y.toFixed(1)}`
  }).join(' ')
}

function fmtMbps(val) {
  if (typeof val !== 'number' || Number.isNaN(val)) return '0.0'
  return (val / 1e6).toFixed(1)
}

export default function HistoryChart({samples, label}) {
  if (!samples || samples.length === 0) {
    return <div className="history-chart__label">No recent history</div>
  }
  const latest = samples[samples.length - 1]
  const ts = new Date(latest.Ts).toLocaleTimeString()
  const rxPts = points(samples, 'Rx')
  const txPts = points(samples, 'Tx')

  return (
    <div>
      <div className="history-chart__label">
        <span>{label}</span>
        <span style={{color:'var(--text-3)'}}>
          rx {fmtMbps(latest.Rx)} / tx {fmtMbps(latest.Tx)} Mbps · {ts}
        </span>
      </div>
      <svg width={W} height={H} style={{display:'block', background:'var(--bg)', border:'1px solid var(--border)', borderRadius:4}}>
        {/* grid lines */}
        <line x1="0" y1={H/2} x2={W} y2={H/2} stroke="var(--border)" strokeWidth="1" />
        {rxPts && <polyline points={rxPts} fill="none" stroke="var(--accent)" strokeWidth="1.5" />}
        {txPts && <polyline points={txPts} fill="none" stroke="#ff8c42" strokeWidth="1.5" opacity="0.8" />}
      </svg>
      <div className="history-chart__label" style={{marginTop:3}}>
        <span><span className="legend-dot legend-dot--rx" /> rx</span>
        <span><span className="legend-dot legend-dot--tx" /> tx</span>
      </div>
    </div>
  )
}
