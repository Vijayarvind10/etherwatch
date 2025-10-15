#!/usr/bin/env python3
"""
Replay M-Lab style telemetry samples into the EtherWatch controller.

Usage:
  python scripts/mlab_replay.py 127.0.0.1:9000 data/mlab_sample.csv

Each CSV row is converted into the NDJSON structure the controller expects
and sent over UDP once per second. Adjust sleep duration or fields as needed.
"""

import csv
import json
import socket
import sys
import time


def main():
  if len(sys.argv) != 3:
    sys.exit("usage: python scripts/mlab_replay.py <controller_host:port> <csv_path>")

  host, port = sys.argv[1].split(":")
  csv_path = sys.argv[2]

  sock = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
  sock.connect((host, int(port)))

  seq = 0
  with open(csv_path, newline="") as f:
    reader = csv.DictReader(f)
    for row in reader:
      try:
        msg = {
          "device_id": row.get("clientLocation", "mlab-demo"),
          "iface": row.get("iface", "uplink"),
          "ts_unix_ms": int(time.time() * 1000),
          "rx_bps": float(row["meanThroughputMbps"]) * 1e6 / 8,
          "tx_bps": float(row["meanThroughputMbps"]) * 1e6 / 8,
          "drops": int(float(row.get("packetRetransmits", 0))),
          "queue_depth": int(float(row.get("queueDepth", 3))),
          "latency_ms": float(row.get("minRTT", 1.0)),
          "seq": seq,
        }
      except (KeyError, ValueError) as err:
        print(f"skipping row {row}: {err}", file=sys.stderr)
        continue

      seq += 1
      payload = json.dumps(msg).encode()
      sock.send(payload)
      print(f"sent: {msg}")
      time.sleep(1.0)


if __name__ == "__main__":
  main()
