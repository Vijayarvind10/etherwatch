package main

import (
	"sync"
	"time"
)

type RateLimiter struct {
	limit  int
	window time.Duration

	mu      sync.Mutex
	buckets map[string]*rateBucket
}

type rateBucket struct {
	count       int
	windowStart time.Time
}

func NewRateLimiter(limit int, window time.Duration) *RateLimiter {
	if limit <= 0 {
		return nil
	}
	return &RateLimiter{
		limit:   limit,
		window:  window,
		buckets: make(map[string]*rateBucket),
	}
}

func (r *RateLimiter) Allow(key string, now time.Time) bool {
	if r == nil {
		return true
	}
	r.mu.Lock()
	defer r.mu.Unlock()

	b, ok := r.buckets[key]
	if !ok {
		b = &rateBucket{windowStart: now}
		r.buckets[key] = b
	}

	if now.Sub(b.windowStart) >= r.window {
		b.windowStart = now
		b.count = 0
	}

	b.count++
	return b.count <= r.limit
}
