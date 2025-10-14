import React from 'react'

export default function PacketFlowAnimation(){
  return (
    <div className="packet-canvas">
      <svg viewBox="0 0 360 220" preserveAspectRatio="xMidYMid meet">
        <defs>
          <path id="packetPath" d="M20 180 C 80 60, 160 60, 220 150 S 320 210, 340 50" />
        </defs>
        <use href="#packetPath" className="packet" />
        <circle r="6" className="packet-node">
          <animateMotion dur="6s" repeatCount="indefinite">
            <mpath href="#packetPath" />
          </animateMotion>
          <animate attributeName="opacity" values="0;1;0" dur="6s" repeatCount="indefinite" />
          <animate attributeName="r" values="2;6;2" dur="6s" repeatCount="indefinite" />
        </circle>
        <circle r="6" className="packet-node">
          <animateMotion dur="6s" repeatCount="indefinite" begin="1.2s">
            <mpath href="#packetPath" />
          </animateMotion>
          <animate attributeName="opacity" values="0;1;0" dur="6s" repeatCount="indefinite" begin="1.2s" />
          <animate attributeName="r" values="2;6;2" dur="6s" repeatCount="indefinite" begin="1.2s" />
        </circle>
        <circle r="6" className="packet-node">
          <animateMotion dur="6s" repeatCount="indefinite" begin="2.4s">
            <mpath href="#packetPath" />
          </animateMotion>
          <animate attributeName="opacity" values="0;1;0" dur="6s" repeatCount="indefinite" begin="2.4s" />
          <animate attributeName="r" values="2;6;2" dur="6s" repeatCount="indefinite" begin="2.4s" />
        </circle>
        <circle r="6" className="packet-node">
          <animateMotion dur="6s" repeatCount="indefinite" begin="3.6s">
            <mpath href="#packetPath" />
          </animateMotion>
          <animate attributeName="opacity" values="0;1;0" dur="6s" repeatCount="indefinite" begin="3.6s" />
          <animate attributeName="r" values="2;6;2" dur="6s" repeatCount="indefinite" begin="3.6s" />
        </circle>
      </svg>
    </div>
  )
}
