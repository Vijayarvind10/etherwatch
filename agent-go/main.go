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

	for {
		for _, ifname := range ifaceList {
			m := Msg{DeviceID: *device, Iface: ifname, TsUnixMs: time.Now().UnixMilli(), RxBps: 1e8, TxBps: 8e7, Drops: 0, Q: 3, LatMs: 0.5, Seq: seq}
			// random spike
			if rand.Float64() < *spikeProb {
				m.Drops = uint32(150 + rand.Intn(200))
				m.Q = int32(25 + rand.Intn(10))
				m.LatMs = 10.0 + rand.Float64()*50.0
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
