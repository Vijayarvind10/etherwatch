import React, {useMemo} from 'react'

export default function TimelineChart({data}){
  const pts = useMemo(()=>{
    if (!data?.length) return {rx:'', tx:'', drops:''}
    const mapLine = (values, h) => {
      const min = Math.min(...values)
      const max = Math.max(...values)
      const spread = max - min || 1
      return values.map((v, i)=>{
        const x = (i / Math.max(1, values.length - 1)) * 100
        const y = h - ((v - min) / spread) * (h - 4) - 2
        return `${x},${y.toFixed(1)}`
      }).join(' ')
    }
    return {
      rx:    mapLine(data.map(d=> d.rx),    56),
      tx:    mapLine(data.map(d=> d.tx),    56),
      drops: mapLine(data.map(d=> d.drops), 56),
    }
  }, [data])

  if (!data?.length) {
    return (
      <section className="timeline-card">
        <div className="timeline-card__header"><h3>Aggregate throughput</h3></div>
        <div className="timeline-card__empty">Awaiting telemetry…</div>
      </section>
    )
  }

  const latest = data[data.length - 1]

  return (
    <section className="timeline-card">
      <div className="timeline-card__header">
        <h3>Aggregate throughput · last {data.length} samples</h3>
        <div className="timeline-card__metrics">
          <span>Rx {fmtGbps(latest.rx)} Gbps</span>
          <span>Tx {fmtGbps(latest.tx)} Gbps</span>
          <span>Drops {latest.drops}</span>
        </div>
      </div>
      <svg className="timeline-card__chart" viewBox="0 0 100 60" preserveAspectRatio="none">
        {/* grid */}
        <line x1="0" y1="20" x2="100" y2="20" stroke="#111" strokeWidth="0.5" vectorEffect="non-scaling-stroke" />
        <line x1="0" y1="40" x2="100" y2="40" stroke="#111" strokeWidth="0.5" vectorEffect="non-scaling-stroke" />
        {pts.rx    && <polyline points={pts.rx}    fill="none" stroke="var(--accent)" strokeWidth="1.5" vectorEffect="non-scaling-stroke" />}
        {pts.tx    && <polyline points={pts.tx}    fill="none" stroke="#ff8c42"       strokeWidth="1.5" vectorEffect="non-scaling-stroke" opacity="0.85" />}
        {pts.drops && <polyline points={pts.drops} fill="none" stroke="var(--danger)" strokeWidth="1"   vectorEffect="non-scaling-stroke" strokeDasharray="4 3" />}
      </svg>
      <div className="timeline-card__legend">
        <span><span className="legend-dot legend-dot--rx" /> Rx</span>
        <span><span className="legend-dot legend-dot--tx" /> Tx</span>
        <span><span className="legend-dot legend-dot--drops" /> Drops</span>
      </div>
    </section>
  )
}

function fmtGbps(bps){ return bps ? (bps/1e9).toFixed(2) : '0.00' }
