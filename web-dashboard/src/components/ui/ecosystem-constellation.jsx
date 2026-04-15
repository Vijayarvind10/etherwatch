import React, {useMemo} from 'react'

const SATELLITE_BRANDS = [
  {label: 'GitHub', bg: '#1f1f23'},
  {label: 'Vercel', bg: '#0a0a0a'},
  {label: 'Stripe', bg: '#635bff'},
  {label: 'Slack', bg: '#1a1d21'},
  {label: 'Linear', bg: '#5e6ad2'},
  {label: 'Figma', bg: '#1e1e1e'},
  {label: 'Notion', bg: '#2a2a2a'},
  {label: 'Discord', bg: '#5865f2'},
]

export default function EcosystemConstellation({
  satelliteCount = 6,
  centerLabel = 'EW',
  accentColor = '#a855f7',
  className = '',
}) {
  const brands = useMemo(() => {
    const count = Math.max(3, Math.min(SATELLITE_BRANDS.length, Math.floor(satelliteCount)))
    return SATELLITE_BRANDS.slice(0, count)
  }, [satelliteCount])

  return (
    <div className={`constellation ${className}`} style={{'--constellation-accent': accentColor}}>
      <div className="constellation__center-glow" />
      <div className="constellation__center">{centerLabel}</div>

      {brands.map((brand, i) => {
        const angle = (360 / brands.length) * i
        return (
          <div
            key={brand.label}
            className="constellation__satellite"
            style={{
              '--sat-angle': `${angle}deg`,
              '--sat-bg': brand.bg,
              '--sat-delay': `${i * 0.35}s`,
            }}
          >
            <span>{brand.label[0]}</span>
          </div>
        )
      })}
    </div>
  )
}
