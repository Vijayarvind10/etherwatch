package main

import (
	"crypto/hmac"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"flag"
	"log"
	"math/rand"
	"net"
	"os"
	"path/filepath"
	"runtime"
	"strconv"
	"strings"
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

func main() {
	ctrl := flag.String("controller", "127.0.0.1:9000", "controller UDP address")
	device := flag.String("device", "sw-01", "device id")
	ifaces := flag.String("ifaces", "eth0", "comma-delimited ifaces")
	period := flag.Duration("period", time.Second, "send period")
	spikeProb := flag.Float64("spike-prob", 0.05, "probability of spike per sample")
	secret := flag.String("secret", "", "shared HMAC secret")
	source := flag.String("source", "synthetic", "telemetry source (synthetic|sysfs)")
	baseLatency := flag.Float64("latency-ms", 1.0, "base latency to report when using real counter sources")
	flag.Parse()

	addr, err := net.ResolveUDPAddr("udp", *ctrl)
	if err != nil {
		log.Fatalf("resolve udp addr: %v", err)
	}
	conn, err := net.DialUDP("udp", nil, addr)
	if err != nil {
		log.Fatalf("dial udp: %v", err)
	}
	defer conn.Close()

	ifaceList := strings.Split(*ifaces, ",")
	seq := uint64(1)
	rand.Seed(time.Now().UnixNano())

	counterCache := make(map[string]ifaceCounter)
	useSysfs := strings.EqualFold(*source, "sysfs")
	if useSysfs && runtime.GOOS != "linux" {
		log.Printf("sysfs source requested but GOOS=%s; defaulting to synthetic", runtime.GOOS)
		useSysfs = false
	}

	for {
		for _, ifname := range ifaceList {
			now := time.Now()
			m := Msg{DeviceID: *device, Iface: ifname, TsUnixMs: now.UnixMilli(), Seq: seq}
			if useSysfs {
				sample, ok := sampleSysfs(counterCache, ifname, now, *baseLatency)
				if !ok {
					// skip sending until we have a delta
					continue
				}
				m.RxBps = sample.rxBps
				m.TxBps = sample.txBps
				m.LatMs = sample.latencyMs
				m.Drops = sample.drops
				m.Q = sample.queueDepth
			} else {
				m.RxBps = 1e8
				m.TxBps = 8e7
				m.Drops = 0
				m.Q = 3
				m.LatMs = 0.5
				if rand.Float64() < *spikeProb {
					m.Drops = uint32(150 + rand.Intn(200))
					m.Q = int32(25 + rand.Intn(10))
					m.LatMs = 10.0 + rand.Float64()*50.0
				}
			}
			if *secret != "" {
				m.Sig = computeSignature(m, []byte(*secret))
			}
			b, _ := json.Marshal(m)
			b = append(b, '\n')
			if _, err := conn.Write(b); err != nil {
				log.Printf("udp write err: %v", err)
			}
			seq++
		}
		time.Sleep(*period)
	}
}

type ifaceCounter struct {
	rxBytes uint64
	txBytes uint64
	drops   uint64
	ts      time.Time
}

type sysfsSample struct {
	rxBps      float64
	txBps      float64
	latencyMs  float64
	drops      uint32
	queueDepth int32
}

func sampleSysfs(cache map[string]ifaceCounter, iface string, now time.Time, baseLatency float64) (sysfsSample, bool) {
	rxBytes, err := readUint(filepath.Join("/sys/class/net", iface, "statistics/rx_bytes"))
	if err != nil {
		log.Printf("sysfs read rx failed (%s): %v", iface, err)
		return sysfsSample{}, false
	}
	txBytes, err := readUint(filepath.Join("/sys/class/net", iface, "statistics/tx_bytes"))
	if err != nil {
		log.Printf("sysfs read tx failed (%s): %v", iface, err)
		return sysfsSample{}, false
	}
	rxDrops, _ := readUint(filepath.Join("/sys/class/net", iface, "statistics/rx_dropped"))
	txDrops, _ := readUint(filepath.Join("/sys/class/net", iface, "statistics/tx_dropped"))

	prev, ok := cache[iface]
	cache[iface] = ifaceCounter{rxBytes: rxBytes, txBytes: txBytes, drops: rxDrops + txDrops, ts: now}
	if !ok || prev.ts.IsZero() {
		return sysfsSample{}, false
	}
	dur := now.Sub(prev.ts).Seconds()
	if dur <= 0 {
		return sysfsSample{}, false
	}
	rxDelta := diffCounter(prev.rxBytes, rxBytes)
	txDelta := diffCounter(prev.txBytes, txBytes)
	dropDelta := diffCounter(prev.drops, rxDrops+txDrops)
	rxBps := float64(rxDelta) * 8 / dur
	txBps := float64(txDelta) * 8 / dur

	queueDepth := int32(2 + dropDelta/50)
	if queueDepth < 0 {
		queueDepth = 0
	}

	return sysfsSample{
		rxBps:      rxBps,
		txBps:      txBps,
		latencyMs:  baseLatency,
		drops:      uint32(dropDelta),
		queueDepth: queueDepth,
	}, true
}

func readUint(path string) (uint64, error) {
	data, err := os.ReadFile(path)
	if err != nil {
		return 0, err
	}
	str := strings.TrimSpace(string(data))
	return strconv.ParseUint(str, 10, 64)
}

func diffCounter(prev, current uint64) uint64 {
	if current >= prev {
		return current - prev
	}
	// handle counter reset
	return current
}

func signingString(m Msg) string {
	parts := []string{
		m.DeviceID,
		m.Iface,
		strconv.FormatInt(m.TsUnixMs, 10),
		strconv.FormatFloat(m.RxBps, 'f', -1, 64),
		strconv.FormatFloat(m.TxBps, 'f', -1, 64),
		strconv.FormatUint(uint64(m.Drops), 10),
		strconv.FormatInt(int64(m.Q), 10),
		strconv.FormatFloat(m.LatMs, 'f', -1, 64),
		strconv.FormatUint(m.Seq, 10),
	}
	return strings.Join(parts, "|")
}

func computeSignature(m Msg, secret []byte) string {
	mac := hmac.New(sha256.New, secret)
	mac.Write([]byte(signingString(m)))
	return hex.EncodeToString(mac.Sum(nil))
}
