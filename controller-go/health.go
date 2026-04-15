package main

import (
	"encoding/json"
	"log"
	"net/http"
	"time"
)

type healthResponse struct {
	Status    string `json:"status"`
	Timestamp int64  `json:"ts"`
	Devices   int    `json:"devices,omitempty"`
}

func registerHealth(mux *http.ServeMux, s *State) {
	mux.HandleFunc("/health", func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		resp := healthResponse{
			Status:    "ok",
			Timestamp: time.Now().UnixMilli(),
		}
		if err := json.NewEncoder(w).Encode(resp); err != nil {
			log.Printf("health encode error: %v", err)
		}
	})

	mux.HandleFunc("/ready", func(w http.ResponseWriter, r *http.Request) {
		s.mu.RLock()
		n := len(s.Devices)
		s.mu.RUnlock()

		resp := healthResponse{
			Status:    "ready",
			Timestamp: time.Now().UnixMilli(),
			Devices:   n,
		}
		if n == 0 {
			w.WriteHeader(http.StatusServiceUnavailable)
			resp.Status = "waiting"
		}
		w.Header().Set("Content-Type", "application/json")
		if err := json.NewEncoder(w).Encode(resp); err != nil {
			log.Printf("ready encode error: %v", err)
		}
	})
}
