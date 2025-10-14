package main

import (
	"crypto/hmac"
	"encoding/json"
	"log"
	"net"
	"time"
)

type Msg struct {
	DeviceID string  `json:"device_id"`
	Iface    string  `json:"iface"`
	TsUnixMs int64   `json:"ts_unix_ms"`
	RxBps    float64 `json:"rx_bps"`
	TxBps    float64 `json:"tx_bps"`
	Drops    uint32  `json:"drops"`
	Q        int32   `json:"queue_depth"`
	LatMs    float64 `json:"latency_ms"`
	Seq      uint64  `json:"seq"`
	Sig      string  `json:"sig,omitempty"`
}

func startUDPListener(addr string, state *State, secret []byte, limiter *RateLimiter) {
	pc, err := net.ListenPacket("udp", addr)
	if err != nil {
		log.Fatalf("udp listen failed: %v", err)
	}
	defer pc.Close()
	log.Printf("udp listening %s", addr)

	buf := make([]byte, 2048)
	for {
		n, _, err := pc.ReadFrom(buf)
		if err != nil {
			log.Printf("udp read error: %v", err)
			continue
		}
		var m Msg
		if err := json.Unmarshal(buf[:n], &m); err != nil {
			log.Printf("json unmarshal failed: %v", err)
			continue
		}
		if limiter != nil && !limiter.Allow(m.DeviceID, time.Now()) {
			log.Printf("rate limit exceeded for device %s", m.DeviceID)
			continue
		}
		if len(secret) > 0 {
			if m.Sig == "" {
				log.Printf("missing signature for device %s iface %s", m.DeviceID, m.Iface)
				continue
			}
			expected := computeSignature(m, secret)
			if !hmac.Equal([]byte(expected), []byte(m.Sig)) {
				log.Printf("invalid signature for device %s iface %s", m.DeviceID, m.Iface)
				continue
			}
		}
		state.Ingest(m)
	}
}
