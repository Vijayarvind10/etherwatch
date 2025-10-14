package main

import (
	"errors"
	"log"
	"sync"
	"time"
)

type Sample struct {
	Ts    int64
	Rx    float64
	Tx    float64
	Drops uint32
	Q     int32
	Lat   float64
	Seq   uint64
}

type IfaceState struct {
	mu       sync.Mutex
	Last     Sample
	Buf      []Sample
	LastSeen time.Time
	EWMARx   float64
	EWMATx   float64
	EWMALat  float64
	Status   string
	breaches int
}

type Device struct {
	ID     string
	Ifaces map[string]*IfaceState
	Status string // OK/ALERT/OFFLINE
}

type State struct {
	mu           sync.RWMutex
	Devices      map[string]*Device
	offlineAfter time.Duration
	hub          *Hub
	alertConsec  int
	history      HistoryStore
}

func NewState(offlineAfter time.Duration, alertConsec int, hub *Hub, history HistoryStore) *State {
	if alertConsec < 1 {
		alertConsec = 1
	}
	if history == nil {
		history = &noopHistory{}
	}
	return &State{
		Devices:      make(map[string]*Device),
		offlineAfter: offlineAfter,
		hub:          hub,
		alertConsec:  alertConsec,
		history:      history,
	}
}

func (s *State) Ingest(m Msg) {
	s.mu.Lock()
	d, ok := s.Devices[m.DeviceID]
	if !ok {
		d = &Device{ID: m.DeviceID, Ifaces: make(map[string]*IfaceState), Status: "OK"}
		s.Devices[m.DeviceID] = d
	}
	ifs, ok := d.Ifaces[m.Iface]
	if !ok {
		ifs = &IfaceState{Buf: make([]Sample, 0, 128), Status: "OK"}
		d.Ifaces[m.Iface] = ifs
	}

	ifs.mu.Lock()
	sample := Sample{Ts: m.TsUnixMs, Rx: m.RxBps, Tx: m.TxBps, Drops: m.Drops, Q: m.Q, Lat: m.LatMs, Seq: m.Seq}
	ifs.Last = sample
	ifs.Buf = append(ifs.Buf, sample)
	if len(ifs.Buf) > 128 {
		copy(ifs.Buf, ifs.Buf[len(ifs.Buf)-128:])
		ifs.Buf = ifs.Buf[len(ifs.Buf)-128:]
	}
	ifs.LastSeen = time.Now()
	// simple EWMA
	alpha := 0.3
	if ifs.EWMARx == 0 {
		ifs.EWMARx = sample.Rx
		ifs.EWMATx = sample.Tx
		ifs.EWMALat = sample.Lat
	} else {
		ifs.EWMARx = alpha*sample.Rx + (1-alpha)*ifs.EWMARx
		ifs.EWMATx = alpha*sample.Tx + (1-alpha)*ifs.EWMATx
		ifs.EWMALat = alpha*sample.Lat + (1-alpha)*ifs.EWMALat
	}
	ifs.mu.Unlock()

	var snap StateSnapshot
	if s.hub != nil {
		snap = s.snapshotLocked()
	}
	s.mu.Unlock()

	if s.hub != nil {
		s.hub.BroadcastState(snap)
	}
	if s.historyEnabled() {
		if err := s.history.StoreSample(m.DeviceID, m.Iface, sample); err != nil {
			log.Printf("history store failed: %v", err)
		}
	}
}

func (s *State) historyEnabled() bool {
	return s.history != nil && s.history.Enabled()
}

func (s *State) FetchHistory(device, iface string, since time.Duration) ([]Sample, error) {
	if !s.historyEnabled() {
		return nil, errors.New("history disabled")
	}
	return s.history.FetchSamples(device, iface, since)
}

func (s *State) snapshotLocked() StateSnapshot {
	snap := StateSnapshot{T: time.Now().UnixMilli(), Devices: make([]DeviceSnapshot, 0)}
	for _, d := range s.Devices {
		ds := DeviceSnapshot{ID: d.ID, Status: d.Status, Ifaces: make([]IfaceSnapshot, 0)}
		for name, ifs := range d.Ifaces {
			ifs.mu.Lock()
			is := IfaceSnapshot{Name: name, RxBps: ifs.Last.Rx, TxBps: ifs.Last.Tx, Drops: int64(ifs.Last.Drops), Q: int(ifs.Last.Q), LatMs: ifs.Last.Lat, Status: ifs.Status}
			ifs.mu.Unlock()
			ds.Ifaces = append(ds.Ifaces, is)
		}
		snap.Devices = append(snap.Devices, ds)
	}
	return snap
}

// snapshot access for other packages
type IfaceSnapshot struct {
	Name   string  `json:"name"`
	RxBps  float64 `json:"rx_bps"`
	TxBps  float64 `json:"tx_bps"`
	Drops  int64   `json:"drops"`
	Q      int     `json:"q"`
	LatMs  float64 `json:"lat_ms"`
	Status string  `json:"status"`
}

type DeviceSnapshot struct {
	ID     string          `json:"id"`
	Status string          `json:"status"`
	Ifaces []IfaceSnapshot `json:"ifaces,omitempty"`
}

type StateSnapshot struct {
	T       int64            `json:"t"`
	Devices []DeviceSnapshot `json:"devices"`
}
