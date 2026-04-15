import React from 'react'
import EcosystemConstellation from './ecosystem-constellation'

export default function EcosystemConstellationDemo() {
  return (
    <section className="constellation-demo">
      <div className="constellation-demo__copy">
        <p className="eyebrow">EtherWatch platform vision</p>
        <h1>From simulation to a real operator-grade observability tool.</h1>
        <p>
          Live network health, intelligent alerts, and fast onboarding in one refined dashboard.
          Start in demo mode, then connect real telemetry with zero UI changes.
        </p>
      </div>

      <div className="constellation-demo__visual">
        <EcosystemConstellation satelliteCount={8} centerLabel="EW" />
      </div>
    </section>
  )
}
