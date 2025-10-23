import React from 'react'

export default function AlertTimeline({events}) {
  if (!events?.length) {
    return (
      <section className="timeline-card">
        <div className="timeline-card__header">
          <h3>Recent events</h3>
        </div>
        <div className="timeline-card__empty">No alerts or offline events yet.</div>
      </section>
    )
  }
  return (
    <section className="timeline-card">
      <div className="timeline-card__header">
        <h3>Recent events</h3>
      </div>
      <ul className="alert-timeline">
        {events.map(evt=> (
          <li key={evt.id} className={`alert-timeline__row alert-timeline__row--${evt.status.toLowerCase()}`}>
            <div className="alert-timeline__time">{new Date(evt.time).toLocaleTimeString()}</div>
            <div className="alert-timeline__device">{evt.device}</div>
            <div className="alert-timeline__status">{evt.status}</div>
            {evt.note && <div className="alert-timeline__note">{evt.note}</div>}
          </li>
        ))}
      </ul>
    </section>
  )
}
