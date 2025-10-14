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
)

func registerMetrics(mux *http.ServeMux, s *State) {
	prometheus.MustRegister(gRx, gTx, gDrops, gStatus, gIfaceStatus)
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
