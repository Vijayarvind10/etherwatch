package main

import (
	"flag"
	"log"
	"net/http"
	"os"
	"path/filepath"
	"strings"
	"time"
)

func main() {
	udpAddr := flag.String("udp", ":9000", "UDP listen address")
	httpAddr := flag.String("http", ":8080", "HTTP listen address")
	metricsAddr := flag.String("metrics", ":9090", "Prometheus metrics address")
	offlineAfter := flag.Duration("offline-after", 5*time.Second, "offline after duration")
	alertConsec := flag.Int("alert-consecutive", 3, "consecutive breached samples required before alerting")
	maxIngest := flag.Int("max-ingest-per-sec", 0, "max ingest messages per device per second (0 disables rate limiting)")
	hmacSecret := flag.String("hmac-secret", "", "shared HMAC secret for agent messages (empty disables verification)")
	historyDir := flag.String("history-dir", "", "directory for persisted history (empty disables)")
	historyRetention := flag.Duration("history-retention", 5*time.Minute, "duration to retain persisted samples")
	staticDir := flag.String("static-dir", "../web-dashboard/dist", "path to built dashboard assets (empty to disable)")
	flag.Parse()

	historyStore, err := openHistoryStore(*historyDir, *historyRetention)
	if err != nil {
		log.Fatalf("history store init failed: %v", err)
	}
	defer historyStore.Close()
	if historyStore.Enabled() {
		log.Printf("history persistence enabled at %s (retention %s)", *historyDir, historyRetention.String())
	}

	hub := NewHub()
	go hub.Run()

	state := NewState(*offlineAfter, *alertConsec, hub, historyStore)

	go startUDPListener(*udpAddr, state, []byte(*hmacSecret), NewRateLimiter(*maxIngest, time.Second))
	go startDetector(state)

	// metrics on separate port
	go func() {
		mux := http.NewServeMux()
		registerMetrics(mux, state)
		log.Printf("metrics listening %s", *metricsAddr)
		if err := http.ListenAndServe(*metricsAddr, mux); err != nil {
			log.Fatalf("metrics server failed: %v", err)
		}
	}()

	// HTTP (WS + static)
	mux := http.NewServeMux()
	mux.HandleFunc("/ws", hub.ServeWS)
	registerHistoryAPI(mux, state)

	staticRegistered := false
	if *staticDir != "" {
		abs, err := filepath.Abs(*staticDir)
		if err != nil {
			log.Printf("error resolving static dir %q: %v", *staticDir, err)
		} else if _, err := os.Stat(abs); err != nil {
			log.Printf("static dir %q not found: %v", abs, err)
		} else {
			log.Printf("serving static assets from %s", abs)
			fileServer := http.FileServer(http.Dir(abs))
			mux.Handle("/", spaHandler(abs, fileServer))
			staticRegistered = true
		}
	}

	if !staticRegistered {
		// default response if no static handler wired
		mux.HandleFunc("/", func(w http.ResponseWriter, r *http.Request) {
			w.Header().Set("Content-Type", "text/plain; charset=utf-8")
			w.WriteHeader(http.StatusOK)
			w.Write([]byte("EtherWatch controller is running.\nBuild the dashboard assets and supply --static-dir to serve the UI.\n"))
		})
	}

	log.Printf("http listening %s", *httpAddr)
	if err := http.ListenAndServe(*httpAddr, mux); err != nil {
		log.Fatalf("http server failed: %v", err)
	}
}

func spaHandler(root string, fs http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		requestPath := r.URL.Path
		if requestPath == "/" {
			fs.ServeHTTP(w, r)
			return
		}
		cleanRel := strings.TrimPrefix(requestPath, "/")
		cleanRel = filepath.Clean(cleanRel)
		full := filepath.Join(root, cleanRel)
		rootWithSep := root + string(os.PathSeparator)
		if full == root || strings.HasPrefix(full, rootWithSep) {
			if _, err := os.Stat(full); err == nil && !strings.HasSuffix(requestPath, "/") {
				fs.ServeHTTP(w, r)
				return
			}
		}
		// fallback to index for SPA routes
		http.ServeFile(w, r, filepath.Join(root, "index.html"))
	})
}
