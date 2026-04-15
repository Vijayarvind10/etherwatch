import React from 'react'

export default function AlertTimeline({events}) {
  return (
    <section className="timeline-card">
      <div className="timeline-card__header">
        <h3>Event log</h3>
        <span style={{fontFamily:'var(--mono)', fontSize:11, color:'var(--text-3)'}}>
          {events?.length ? `${events.length} events` : ''}
        </span>
      </div>
      {(!events || events.length === 0) ? (
        <div className="timeline-card__empty">No alert or offline events recorded.</div>
      ) : (
        <ul className="alert-timeline">
          {events.map(evt=> (
            <li key={evt.id} className={`alert-timeline__row alert-timeline__row--${evt.status.toLowerCase()}`}>
              <div className="alert-timeline__time">{new Date(evt.time).toLocaleTimeString()}</div>
              <div className="alert-timeline__device">{evt.device}</div>
              <div className="alert-timeline__status" style={{color: evt.status === 'ALERT' ? 'var(--danger)' : 'var(--muted)'}}>
                {evt.status}
              </div>
              <div className="alert-timeline__note">{evt.note}</div>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}
