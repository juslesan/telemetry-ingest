# Telemetry Ingest Exercise

## Overview
This exercise simulates a telemetry ingest platform that receives high-volume event traffic over HTTP and stores it in SQLite. It includes:

- `ingest-api`: HTTP ingest API backed by SQLite
- `load-generator`: bursty client that sends single-event requests, including duplicates and out-of-order timestamps

Other than changing the load-generator URL, the existing services should remain unchanged.

The goal for the candidate is to design and implement a stream-processing middleware that can absorb bursty traffic, improve throughput, and clean up the data stream (deduplicate, handle out-of-order events) before storage.

This setup is only a starting point. Candidates are free to change the design, swap technologies, and showcase any improvements they believe make the solution stronger (as long as the core functionality still works).

## Exercise Requirements (for candidate)
- Build two services:
  - `ingest-proxy` (port `4000`): HTTP ingress proxy that accepts telemetry events and publishes them to Redpanda.
  - `stream-processor` (no public port): consumer that reads from Redpanda and forwards cleaned events to `ingest-api` in a batched manner.
- Use a Redpanda topic named `telemetry-events`.
- Add both services to `docker-compose.yml` so they run alongside Redpanda and the existing services.
- Implement throughput improvements (batching, backpressure, queueing, or streaming).
- Implement data cleanup (deduplication and ordering/windowing rules).
- You are free to add any additional services or tools to the stack. For example logging, metrics, etc.
- Scaffolding is in TypeScript, but you can use any tech stack; if you switch stacks, update `docker-compose.yml` for `ingest-proxy` and `stream-processor` accordingly.

##
**Important**

After you have created your solution, you must override the `INGEST_URL` environment variable in `docker-compose.yml`'s `stream-processor` service to point to your ingress proxy.

##

### Provided Environment Variables
**Ingest Proxy**
- `PORT` (default `4000`)
- `KAFKA_BROKERS` (default `redpanda:9092`)
- `KAFKA_TOPIC` (default `telemetry-events`)

**Stream Processor**
- `KAFKA_BROKERS` (default `redpanda:9092`)
- `KAFKA_TOPIC` (default `telemetry-events`)
- `INGEST_URL` (default `http://ingest-api:3000/events/batch`)

## Event Schema
Each telemetry event is a JSON object with the following fields:

- `deviceId` (string): Unique identifier of the device emitting the event.
- `ts` (number): Event timestamp in epoch milliseconds.
- `latitude` (number): Latitude in decimal degrees.
- `longitude` (number): Longitude in decimal degrees.

## Run Locally
### With Docker Compose
```bash
docker compose up --build
```

The ingest API will be available at `http://localhost:3000`.
The load generator will start automatically and begin sending bursts.
You can view ingested events at `http://localhost:3000/events` with pagination via `page` and `size` query params.

## Load Generator Configuration
You can override these environment variables:

- `INGEST_URL` (default `http://localhost:3000/event`) - URL to send events to. **Important** After you have created your solution, you must override this environment variable to point to your ingress proxy.
- `DEVICES` (default `5`) - Number of devices to simulate
- `BURSTS` (default `10`) - Number of bursts to send
- `BURST_SIZE` (default `100`) - Number of events per burst
- `BURST_INTERVAL_MS` (default `1000`) - Interval between bursts in milliseconds
- `DUPLICATE_RATE` (default `0.05`)
- `OUT_OF_ORDER_RATE` (default `0.1`)
- `MAX_OUT_OF_ORDER_MS` (default `5000`)
- `BASE_LAT` (default `37.7749`)
- `BASE_LON` (default `-122.4194`)
