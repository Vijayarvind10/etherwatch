package main

import (
	"encoding/json"
	"net/http"
	"strconv"
	"time"
)

func registerHistoryAPI(mux *http.ServeMux, state *State) {
	mux.HandleFunc("/api/history", func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Access-Control-Allow-Origin", "*")
		w.Header().Set("Access-Control-Allow-Methods", "GET, OPTIONS")
		w.Header().Set("Access-Control-Allow-Headers", "Content-Type")

		if r.Method == http.MethodOptions {
			w.WriteHeader(http.StatusNoContent)
			return
		}
		if r.Method != http.MethodGet {
			http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
			return
		}
		if !state.historyEnabled() {
			http.Error(w, "history disabled", http.StatusNotFound)
			return
		}

		device := r.URL.Query().Get("device")
		iface := r.URL.Query().Get("iface")
		if device == "" || iface == "" {
			http.Error(w, "device and iface are required", http.StatusBadRequest)
			return
		}

		minutesStr := r.URL.Query().Get("minutes")
		minutes := 5
		if minutesStr != "" {
			if v, err := strconv.Atoi(minutesStr); err == nil && v > 0 {
				minutes = v
			}
		}
		samples, err := state.FetchHistory(device, iface, time.Duration(minutes)*time.Minute)
		if err != nil {
			http.Error(w, err.Error(), http.StatusInternalServerError)
			return
		}

		resp := map[string]interface{}{
			"device":  device,
			"iface":   iface,
			"minutes": minutes,
			"samples": samples,
		}
		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(resp)
	})
}
