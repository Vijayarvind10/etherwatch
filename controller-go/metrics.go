package main

import (
	"net/http"
	"time"

	"github.com/prometheus/client_golang/prometheus"
	"github.com/prometheus/client_golang/prometheus/promhttp"
)

var (
	gRx          = prometheus.NewGaugeVec(prometheus.GaugeOpts{Name: "etherwatch_rx_bps", Help: "rx bps"}, []string{"device", "iface"})
	gTx          = prometheus.NewGaugeVec(prometheus.GaugeOpts{Name: "etherwatch_tx_bps", Help: "tx bps"}, []string{"device", "iface"})
	gDrops       = prometheus.NewGaugeVec(prometheus.GaugeOpts{Name: "etherwatch_drops_total", Help: "drops"}, []string{"device", "iface"})
	gStatus      = prometheus.NewGaugeVec(prometheus.GaugeOpts{Name: "etherwatch_device_status", Help: "device status (1=OK,0=ALERT,-1=OFFLINE)"}, []string{"device"})
	gIfaceStatus = prometheus.NewGaugeVec(prometheus.GaugeOpts{Name: "etherwatch_iface_status", Help: "iface status (1=OK,0=ALERT,-1=OFFLINE)"}, []string{"device", "iface"})
	gSeqGap      = prometheus.NewGaugeVec(prometheus.GaugeOpts{Name: "etherwatch_iface_seq_gap_total", Help: "total missing packets detected for an interface"}, []string{"device", "iface"})

	cUDPReceived = prometheus.NewCounter(prometheus.CounterOpts{
		Name: "etherwatch_udp_packets_received_total",
		Help: "Total UDP packets received",
	})
	cHMACFailures = prometheus.NewCounter(prometheus.CounterOpts{
		Name: "etherwatch_hmac_failures_total",
		Help: "Total HMAC validation failures",
	})
	cRateLimitHits = prometheus.NewCounter(prometheus.CounterOpts{
		Name: "etherwatch_rate_limit_hits_total",
		Help: "Total packets dropped by rate limiter",
	})
	hIngestLatency = prometheus.NewHistogram(prometheus.HistogramOpts{
		Name:    "etherwatch_ingest_latency_seconds",
		Help:    "Duration from UDP receive to state store",
		Buckets: prometheus.DefBuckets,
	})
)

func registerMetrics(mux *http.ServeMux, s *State) {
	prometheus.MustRegister(gRx, gTx, gDrops, gStatus, gIfaceStatus, gSeqGap, cUDPReceived, cHMACFailures, cRateLimitHits, hIngestLatency)
	mux.Handle("/metrics", promhttp.Handler())

	// simple background updater
	go func() {
		ticker := time.NewTicker(2 * time.Second)
		for range ticker.C {
			s.mu.RLock()
			for _, d := range s.Devices {
				for name, ifs := range d.Ifaces {
					ifs.mu.Lock()
					gRx.WithLabelValues(d.ID, name).Set(ifs.Last.Rx)
					gTx.WithLabelValues(d.ID, name).Set(ifs.Last.Tx)
					gDrops.WithLabelValues(d.ID, name).Set(float64(ifs.Last.Drops))
					gIfaceStatus.WithLabelValues(d.ID, name).Set(statusValue(ifs.Status))
					gSeqGap.WithLabelValues(d.ID, name).Set(float64(ifs.GapCount))
					ifs.mu.Unlock()
				}
				// status mapping
				gStatus.WithLabelValues(d.ID).Set(statusValue(d.Status))
			}
			s.mu.RUnlock()
		}
	}()
}

func statusValue(status string) float64 {
	switch status {
	case "OK":
		return 1
	case "OFFLINE":
		return -1
	case "ALERT":
		return 0
	default:
		return 0
	}
}
