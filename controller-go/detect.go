package main

import (
	"log"
	"time"
)

type Thresholds struct {
	MaxDrops int
	MaxQ     int
	MaxLatMs float64
}

func DefaultThresholds() Thresholds {
	return Thresholds{MaxDrops: 100, MaxQ: 20, MaxLatMs: 5.0}
}

func startDetector(s *State) {
	ticker := time.NewTicker(1 * time.Second)
	for range ticker.C {
		snap := s.evaluateStatuses(time.Now())
		if s.hub != nil {
			s.hub.BroadcastState(snap)
		}
		log.Printf("detector tick: devices=%d", len(snap.Devices))
	}
}

func (s *State) evaluateStatuses(now time.Time) StateSnapshot {
	s.mu.Lock()
	defer s.mu.Unlock()

	for _, d := range s.Devices {
		deviceStatus := "OFFLINE"
		for _, ifs := range d.Ifaces {
			ifs.mu.Lock()
			status := evaluateIfaceStatus(ifs, now, s.offlineAfter, s.alertConsec, s.thresholds)
			ifs.Status = status
			if status == "ALERT" {
				deviceStatus = "ALERT"
			} else if status == "OK" && deviceStatus != "ALERT" {
				deviceStatus = "OK"
			}
			ifs.mu.Unlock()
		}
		d.Status = deviceStatus
	}
	return s.snapshotLocked()
}

func evaluateIfaceStatus(ifs *IfaceState, now time.Time, offlineAfter time.Duration, alertConsec int, th Thresholds) string {
	if now.Sub(ifs.LastSeen) > offlineAfter {
		ifs.breaches = 0
		return "OFFLINE"
	}

	breach := int(ifs.Last.Drops) > th.MaxDrops || int(ifs.Last.Q) > th.MaxQ || ifs.Last.Lat > th.MaxLatMs
	if breach {
		ifs.breaches++
	} else {
		ifs.breaches = 0
	}

	if ifs.breaches >= alertConsec {
		return "ALERT"
	}
	return "OK"
}
