package main

import (
	"encoding/json"
	"log"
	"net/http"
	"sync"
	"time"

	"github.com/gorilla/websocket"
)

type Hub struct {
	clients   map[*websocket.Conn]bool
	mu        sync.Mutex
	broadcast chan StateSnapshot
}

func NewHub() *Hub {
	return &Hub{clients: make(map[*websocket.Conn]bool), broadcast: make(chan StateSnapshot, 32)}
}

func (h *Hub) Run() {
	ticker := time.NewTicker(1 * time.Second)
	for {
		select {
		case snap := <-h.broadcast:
			h.mu.Lock()
			for c := range h.clients {
				if err := c.WriteJSON(snap); err != nil {
					log.Printf("ws write err: %v", err)
					c.Close()
					delete(h.clients, c)
				}
			}
			h.mu.Unlock()
		case <-ticker.C:
			// heartbeat: could broadcast empty or heartbeat
		}
	}
}

func (h *Hub) ServeWS(w http.ResponseWriter, r *http.Request) {
	upgrader := websocket.Upgrader{CheckOrigin: func(r *http.Request) bool { return true }}
	c, err := upgrader.Upgrade(w, r, nil)
	if err != nil {
		log.Printf("ws upgrade err: %v", err)
		return
	}
	h.mu.Lock()
	h.clients[c] = true
	h.mu.Unlock()
	// send initial state on connect if available
	// keep reader to detect close
	go func() {
		defer func() { c.Close(); h.mu.Lock(); delete(h.clients, c); h.mu.Unlock() }()
		for {
			var v interface{}
			if err := c.ReadJSON(&v); err != nil {
				// client closed or sent invalid
				return
			}
		}
	}()
}

func (h *Hub) BroadcastState(s StateSnapshot) {
	select {
	case h.broadcast <- s:
	default:
		// drop if channel full
		log.Printf("broadcast channel full, dropping snapshot")
	}
}

// helper to marshal snapshot (unused but handy)
func marshalSnapshot(s StateSnapshot) []byte {
	b, _ := json.Marshal(s)
	return b
}
