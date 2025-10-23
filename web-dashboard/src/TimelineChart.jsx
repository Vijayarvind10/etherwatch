import React, {useMemo} from 'react'

export default function TimelineChart({data}){
  const points = useMemo(()=>{
    if (!data?.length) return {rx:'', tx:'', drops:''}
    const minRx = Math.min(...data.map(d=> d.rx))
    const maxRx = Math.max(...data.map(d=> d.rx))
    const minTx = Math.min(...data.map(d=> d.tx))
    const maxTx = Math.max(...data.map(d=> d.tx))
    const minDrops = Math.min(...data.map(d=> d.drops))
    const maxDrops = Math.max(...data.map(d=> d.drops))

    const mapPoints = (values, min, max, height)=>{
      const spread = max - min || 1
      return values.map((val, idx)=>{
        const x = (idx / Math.max(1, values.length - 1)) * 100
        const y = height - ((val - min) / spread) * height
        return `${x},${y}`
      }).join(' ')
    }

    return {
      rx: mapPoints(data.map(d=> d.rx), minRx, maxRx, 60),
      tx: mapPoints(data.map(d=> d.tx), minTx, maxTx, 60),
      drops: mapPoints(data.map(d=> d.drops), minDrops, maxDrops, 60),
    }
  }, [data])

  if (!data?.length) {
    return (
      <section className="timeline-card">
        <div className="timeline-card__empty">Timeline will appear when telemetry is flowing.</div>
      </section>
    )
  }

  const latest = data[data.length - 1]

  return (
    <section className="timeline-card">
      <div className="timeline-card__header">
        <h3>Telemetry timeline (last 30 samples)</h3>
        <div className="timeline-card__metrics">
          <span>Rx {formatGbps(latest.rx)} Gbps</span>
          <span>Tx {formatGbps(latest.tx)} Gbps</span>
          <span>Drops {latest.drops}</span>
        </div>
      </div>
      <svg className="timeline-card__chart" viewBox="0 0 100 60" preserveAspectRatio="none">
        {points.rx && <polyline points={points.rx} fill="none" stroke="rgba(65,209,255,0.85)" strokeWidth="1.5" />}
        {points.tx && <polyline points={points.tx} fill="none" stroke="rgba(255,140,66,0.8)" strokeWidth="1.5" />}
        {points.drops && <polyline points={points.drops} fill="none" stroke="rgba(255,107,107,0.75)" strokeWidth="1.2" strokeDasharray="4 3" />}
      </svg>
      <div className="timeline-card__legend">
        <span><span className="legend-dot legend-dot--rx" /> Rx</span>
        <span><span className="legend-dot legend-dot--tx" /> Tx</span>
        <span><span className="legend-dot legend-dot--drops" /> Drops</span>
      </div>
    </section>
  )
}

function formatGbps(bps){
  if (!bps) return '0.00'
  return (bps / 1e9).toFixed(2)
}
