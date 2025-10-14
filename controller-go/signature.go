package main

import (
	"crypto/hmac"
	"crypto/sha256"
	"encoding/hex"
	"strconv"
	"strings"
)

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
