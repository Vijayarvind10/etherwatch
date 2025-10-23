import React from 'react'

const cards = [
  {
    title: 'Prometheus Metrics',
    description: 'Scrape live gauges like throughput, drops, status, and sequence gaps.',
    href: 'http://localhost:9090/metrics',
    action: 'Open metrics endpoint',
  },
  {
    title: 'History API',
    description: 'Query rolling telemetry snapshots per interface for drill-down charts.',
    href: '#',
    action: 'Example: /api/history?device=demo&iface=eth0',
  },
  {
    title: 'Compose Stack',
    description: 'Spin up controller, dashboard, and agent with docker compose for demos.',
    href: 'https://github.com/Vijayarvind10/etherwatch/blob/main/docker-compose.yml',
    action: 'View docker-compose.yml',
  },
]

export default function IntegrationPanel(){
  return (
    <section className="integration-panel">
      <h3>Integrations & tooling</h3>
      <div className="integration-panel__grid">
        {cards.map(card=> (
          <article key={card.title} className="integration-card">
            <h4>{card.title}</h4>
            <p>{card.description}</p>
            <a href={card.href} target={card.href === '#' ? undefined : '_blank'} rel="noreferrer">{card.action}</a>
          </article>
        ))}
      </div>
    </section>
  )
}
