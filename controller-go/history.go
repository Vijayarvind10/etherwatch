package main

import (
	"encoding/json"
	"errors"
	"fmt"
	"os"
	"path/filepath"
	"strconv"
	"strings"
	"time"

	"github.com/dgraph-io/badger/v4"
)

type HistoryStore interface {
	StoreSample(device, iface string, sample Sample) error
	FetchSamples(device, iface string, since time.Duration) ([]Sample, error)
	Enabled() bool
	Close() error
}

type noopHistory struct{}

func (n *noopHistory) StoreSample(string, string, Sample) error { return nil }
func (n *noopHistory) FetchSamples(string, string, time.Duration) ([]Sample, error) {
	return nil, errors.New("history disabled")
}
func (n *noopHistory) Enabled() bool { return false }
func (n *noopHistory) Close() error  { return nil }

type badgerHistory struct {
	db  *badger.DB
	ttl time.Duration
}

func (b *badgerHistory) key(device, iface string, ts int64) []byte {
	return []byte(fmt.Sprintf("%s|%s|%020d", device, iface, ts))
}

func (b *badgerHistory) StoreSample(device, iface string, sample Sample) error {
	entryBytes, err := json.Marshal(sample)
	if err != nil {
		return err
	}
	e := badger.NewEntry(b.key(device, iface, sample.Ts), entryBytes).WithTTL(b.ttl)
	return b.db.Update(func(txn *badger.Txn) error {
		return txn.SetEntry(e)
	})
}

func (b *badgerHistory) FetchSamples(device, iface string, since time.Duration) ([]Sample, error) {
	cutoff := time.Now().Add(-since).UnixMilli()
	prefix := []byte(fmt.Sprintf("%s|%s|", device, iface))
	out := make([]Sample, 0, 128)

	err := b.db.View(func(txn *badger.Txn) error {
		it := txn.NewIterator(badger.IteratorOptions{
			PrefetchValues: true,
		})
		defer it.Close()
		for it.Seek(prefix); it.ValidForPrefix(prefix); it.Next() {
			item := it.Item()
			key := string(item.Key())
			tsPart := key[strings.LastIndex(key, "|")+1:]
			ts, err := strconv.ParseInt(tsPart, 10, 64)
			if err != nil {
				continue
			}
			if ts < cutoff {
				continue
			}
			err = item.Value(func(val []byte) error {
				var sample Sample
				if err := json.Unmarshal(val, &sample); err != nil {
					return err
				}
				out = append(out, sample)
				return nil
			})
			if err != nil {
				return err
			}
		}
		return nil
	})
	return out, err
}

func (b *badgerHistory) Enabled() bool { return true }

func (b *badgerHistory) Close() error {
	return b.db.Close()
}

func openHistoryStore(dir string, ttl time.Duration) (HistoryStore, error) {
	if strings.TrimSpace(dir) == "" {
		return &noopHistory{}, nil
	}
	if err := os.MkdirAll(dir, 0o755); err != nil {
		return nil, fmt.Errorf("creating history dir: %w", err)
	}
	opts := badger.DefaultOptions(filepath.Clean(dir))
	opts = opts.WithLogger(nil)
	db, err := badger.Open(opts)
	if err != nil {
		return nil, err
	}
	return &badgerHistory{db: db, ttl: ttl}, nil
}
