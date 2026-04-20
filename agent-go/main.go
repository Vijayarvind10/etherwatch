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
	"os/exec"
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
	source := flag.String("source", "synthetic", "telemetry source: synthetic | sysfs (Linux) | macos")
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
	useMacOS := strings.EqualFold(*source, "macos")

	if useSysfs && runtime.GOOS != "linux" {
		log.Printf("sysfs source requires Linux (GOOS=%s); try --source macos on macOS", runtime.GOOS)
		useSysfs = false
	}
	if useMacOS && runtime.GOOS != "darwin" {
		log.Printf("macos source requires macOS (GOOS=%s); use --source sysfs on Linux", runtime.GOOS)
		useMacOS = false
	}

	for {
		for _, ifname := range ifaceList {
			now := time.Now()
			m := Msg{DeviceID: *device, Iface: ifname, TsUnixMs: now.UnixMilli(), Seq: seq}
			if useSysfs {
				sample, ok := sampleSysfs(counterCache, ifname, now, *baseLatency)
				if !ok {
					continue
				}
				m.RxBps = sample.rxBps
				m.TxBps = sample.txBps
				m.LatMs = sample.latencyMs
				m.Drops = sample.drops
				m.Q = sample.queueDepth
			} else if useMacOS {
				sample, ok := sampleNetstat(counterCache, ifname, now, *baseLatency)
				if !ok {
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

// sampleNetstat reads network interface counters on macOS via `netstat -ib`.
// It reuses the same ifaceCounter cache and delta logic as sampleSysfs so the
// rest of the agent is completely unaware of the underlying OS.
func sampleNetstat(cache map[string]ifaceCounter, iface string, now time.Time, baseLatency float64) (sysfsSample, bool) {
	out, err := exec.Command("netstat", "-ib").Output()
	if err != nil {
		log.Printf("netstat -ib failed: %v", err)
		return sysfsSample{}, false
	}
	rxBytes, txBytes, drops, found := parseNetstatIface(out, iface)
	if !found {
		log.Printf("netstat: interface %q not found in output", iface)
		return sysfsSample{}, false
	}

	prev, ok := cache[iface]
	cache[iface] = ifaceCounter{rxBytes: rxBytes, txBytes: txBytes, drops: drops, ts: now}
	if !ok || prev.ts.IsZero() {
		return sysfsSample{}, false
	}
	dur := now.Sub(prev.ts).Seconds()
	if dur <= 0 {
		return sysfsSample{}, false
	}
	rxDelta := diffCounter(prev.rxBytes, rxBytes)
	txDelta := diffCounter(prev.txBytes, txBytes)
	dropDelta := diffCounter(prev.drops, drops)
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

// parseNetstatIface extracts cumulative byte and error counters from `netstat -ib`
// output for the named interface's hardware (Link#) row.
//
// macOS netstat -ib columns on the Link# row:
//
//	With MAC address (physical ifaces like en0, en1):
//	  Name Mtu Network Address Ipkts Ierrs Ibytes Opkts Oerrs Obytes Coll   → 11 fields
//	Without MAC address (virtual ifaces like lo0, utun*):
//	  Name Mtu Network Ipkts Ierrs Ibytes Opkts Oerrs Obytes Coll           → 10 fields
//
// Ierrs+Oerrs is used as the drops proxy (closest equivalent to sysfs rx_dropped+tx_dropped).
func parseNetstatIface(data []byte, iface string) (rx, tx, drops uint64, found bool) {
	for _, line := range strings.Split(string(data), "\n") {
		fields := strings.Fields(line)
		if len(fields) < 10 {
			continue
		}
		if fields[0] != iface {
			continue
		}
		if !strings.HasPrefix(fields[2], "<Link#") {
			continue
		}
		var ibytesIdx, obytesIdx, ierrsIdx, oerrsIdx int
		if len(fields) >= 11 {
			// physical interface: has MAC address at index 3
			ibytesIdx, obytesIdx, ierrsIdx, oerrsIdx = 6, 9, 5, 8
		} else {
			// virtual interface: no address column
			ibytesIdx, obytesIdx, ierrsIdx, oerrsIdx = 5, 8, 4, 7
		}
		rx = parseNetstatUint(fields[ibytesIdx])
		tx = parseNetstatUint(fields[obytesIdx])
		drops = parseNetstatUint(fields[ierrsIdx]) + parseNetstatUint(fields[oerrsIdx])
		found = true
		return
	}
	return
}

// parseNetstatUint parses a netstat column value; returns 0 for "-" (unused fields).
func parseNetstatUint(s string) uint64 {
	if s == "-" {
		return 0
	}
	v, _ := strconv.ParseUint(s, 10, 64)
	return v
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
