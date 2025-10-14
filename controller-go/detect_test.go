package main

import (
	"testing"
	"time"
)

func TestEvaluateIfaceStatusConsecutive(t *testing.T) {
	now := time.Now()
	ifs := &IfaceState{LastSeen: now}

	ifs.Last = Sample{Drops: 150}
	if status := evaluateIfaceStatus(ifs, now, 5*time.Second, 3); status != "OK" {
		t.Fatalf("expected OK after first breach, got %s", status)
	}
	if status := evaluateIfaceStatus(ifs, now, 5*time.Second, 3); status != "OK" {
		t.Fatalf("expected OK after second breach, got %s", status)
	}
	if status := evaluateIfaceStatus(ifs, now, 5*time.Second, 3); status != "ALERT" {
		t.Fatalf("expected ALERT after third breach, got %s", status)
	}
	if ifs.breaches != 3 {
		t.Fatalf("expected breaches count 3, got %d", ifs.breaches)
	}

	ifs.Last = Sample{Drops: 0}
	if status := evaluateIfaceStatus(ifs, now, 5*time.Second, 3); status != "OK" {
		t.Fatalf("expected OK after recovery, got %s", status)
	}
	if ifs.breaches != 0 {
		t.Fatalf("expected breaches reset to 0, got %d", ifs.breaches)
	}

	ifs.LastSeen = now.Add(-6 * time.Second)
	if status := evaluateIfaceStatus(ifs, now, 5*time.Second, 3); status != "OFFLINE" {
		t.Fatalf("expected OFFLINE when past offlineAfter, got %s", status)
	}
	if ifs.breaches != 0 {
		t.Fatalf("expected breaches cleared when offline, got %d", ifs.breaches)
	}
}

func TestStateEvaluateStatusesAggregatesDevice(t *testing.T) {
	now := time.Now()
	state := NewState(5*time.Second, 3, nil, &noopHistory{})

	iface := &IfaceState{LastSeen: now}
	device := &Device{ID: "sw-01", Ifaces: map[string]*IfaceState{"eth0": iface}}

	state.mu.Lock()
	state.Devices[device.ID] = device
	state.mu.Unlock()

	snap := state.evaluateStatuses(now)
	if got := snap.Devices[0].Status; got != "OK" {
		t.Fatalf("expected device status OK, got %s", got)
	}

	for i := 0; i < 3; i++ {
		state.mu.Lock()
		iface.Last = Sample{Drops: 200}
		iface.LastSeen = now
		state.mu.Unlock()
		snap = state.evaluateStatuses(now)
	}
	if got := snap.Devices[0].Status; got != "ALERT" {
		t.Fatalf("expected device status ALERT after consecutive breaches, got %s", got)
	}
	if snap.Devices[0].Ifaces[0].Status != "ALERT" {
		t.Fatalf("expected iface status ALERT, got %s", snap.Devices[0].Ifaces[0].Status)
	}

	state.mu.Lock()
	iface.LastSeen = now.Add(-10 * time.Second)
	state.mu.Unlock()
	snap = state.evaluateStatuses(now)
	if got := snap.Devices[0].Status; got != "OFFLINE" {
		t.Fatalf("expected device status OFFLINE when iface stale, got %s", got)
	}
	if snap.Devices[0].Ifaces[0].Status != "OFFLINE" {
		t.Fatalf("expected iface status OFFLINE, got %s", snap.Devices[0].Ifaces[0].Status)
	}
}
