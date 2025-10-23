.PHONY: controller agent-synthetic agent-sysfs demo dashboard-build clean

controller:
	cd controller-go && go run . --udp :9000 --http :8080 --metrics :9090 --offline-after 5s --history-dir ./history --history-retention 10m

agent-synthetic:
	cd agent-go && go run . --controller 127.0.0.1:9000 --device demo-switch --ifaces eth0,eth1 --period 1s --spike-prob 0.2

agent-sysfs:
ifndef IFACE
	$(error Please provide IFACE=<interface>, e.g. make agent-sysfs IFACE=wlan0)
endif
	cd agent-go && go run . --controller 127.0.0.1:9000 --device $(IFACE)-node --ifaces $(IFACE) --period 2s --source sysfs --latency-ms 2.0

demo:
	python scripts/mlab_replay.py 127.0.0.1:9000 data/mlab_sample.csv

dashboard-build:
	cd web-dashboard && npm install && npm run build

clean:
	rm -f controller-go/etherwatch-controller agent-go/etherwatch-agent
	rm -rf controller-go/history
