import React from 'react'

const WIDTH = 220
const HEIGHT = 70

function pointsFor(samples, key) {
  if (!samples || samples.length === 0) return ''
  if (samples.length === 1) {
    return `0,${HEIGHT / 2} ${WIDTH},${HEIGHT / 2}`
  }
  const values = samples.map(s => Number(s[key] ?? 0))
  let min = Math.min(...values)
  let max = Math.max(...values)
  if (!isFinite(min) || !isFinite(max)) {
    return ''
  }
  if (min === max) {
    min = 0
  }
  const range = max - min || 1
  return values
    .map((val, idx) => {
      const x = (idx / (values.length - 1)) * WIDTH
      const y = HEIGHT - ((val - min) / range) * HEIGHT
      return `${x.toFixed(1)},${y.toFixed(1)}`
    })
    .join(' ')
}

function formatMbps(val) {
  if (typeof val !== 'number' || Number.isNaN(val)) return '0.0'
  return (val / 1e6).toFixed(1)
}

export default function HistoryChart({samples, label}) {
  if (!samples || samples.length === 0) {
    return <div style={{fontSize: 12, color: '#666'}}>No recent history</div>
  }
  const latest = samples[samples.length - 1]
  const ts = new Date(latest.Ts)
  const rxPoints = pointsFor(samples, 'Rx')
  const txPoints = pointsFor(samples, 'Tx')

  return (
    <div style={{marginTop: 8}}>
      <div style={{fontSize: 12, marginBottom: 4, display:'flex', justifyContent:'space-between'}}>
        <span>{label}</span>
        <span style={{color:'#555'}}>
          rx {formatMbps(latest.Rx)} / tx {formatMbps(latest.Tx)} Mbps @ {ts.toLocaleTimeString()}
        </span>
      </div>
      <svg width={WIDTH} height={HEIGHT} style={{border:'1px solid #eee', borderRadius:4, background:'#fafafa'}}>
        {rxPoints && <polyline points={rxPoints} fill="none" stroke="#3366ff" strokeWidth="2" />}
        {txPoints && <polyline points={txPoints} fill="none" stroke="#ff8c42" strokeWidth="2" opacity="0.7" />}
      </svg>
      <div style={{fontSize: 11, color:'#777', marginTop:4}}>
        <span style={{marginRight:8}}><span style={{color:'#3366ff'}}>●</span> rx</span>
        <span><span style={{color:'#ff8c42'}}>●</span> tx</span>
      </div>
    </div>
  )
}
