import React from 'react'

export default function IntegrationPanel({metricsOrigin = 'http://localhost:9090'}){
  const cards = [
    {
      title: 'Prometheus Metrics',
      description: 'Scrape live gauges: throughput, drops, status, sequence gaps, ingest latency.',
      href: `${metricsOrigin}/metrics`,
      action: 'Open metrics endpoint →',
    },
    {
      title: 'History API',
      description: 'Query rolling telemetry snapshots per interface for drill-down analysis.',
      href: '#integrations',
      action: '/api/history?device=X&iface=Y&minutes=5',
    },
    {
      title: 'Compose Stack',
      description: 'Spin up controller, dashboard, and sysfs agent with one command.',
      href: 'https://github.com/Vijayarvind10/etherwatch/blob/main/docker-compose.yml',
      action: 'View docker-compose.yml →',
    },
  ]

  return (
    <section className="integration-panel" id="integrations">
      <h3>Integrations & tooling</h3>
      <div className="integration-panel__grid">
        {cards.map(card=> (
          <article key={card.title} className="integration-card">
            <h4>{card.title}</h4>
            <p>{card.description}</p>
            <a
              href={card.href}
              target={card.href.startsWith('http') ? '_blank' : undefined}
              rel="noreferrer"
            >
              {card.action}
            </a>
          </article>
        ))}
      </div>
    </section>
  )
}
