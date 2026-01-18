import Heap from "heap-js";
import { SubscribingKafkaClient, TelemetryEvent } from "./SubscribingKafkaClient";

const KAFKA_BROKERS = process.env.KAFKA_BROKERS || 'redpanda:9092';
const KAFKA_TOPIC = process.env.KAFKA_TOPIC || 'telemetry-events';
const INGEST_URL = process.env.INGEST_URL || 'http://ingest-api:3000/events/batch';

const EMIT_DELAY = Number(process.env.EMIT_DELAY ?? 6000);
const EMIT_INTERVAL = Number(process.env.EMIT_INTERVAL ?? 1000);
const MAX_BATCH_SIZE = Number(process.env.MAX_BATCH_SIZE ?? 1000);


// This solution only really works if we know the max out-of-order time.
// In real life use cases this is not a solid solution but given that
// max out-of-order time is known the events should be ordered by the timestamps.

const heap = new Heap<TelemetryEvent>((a: TelemetryEvent, b: TelemetryEvent) => a.ts - b.ts);

let emitIntervalRef: NodeJS.Timeout;

const emitReadyEvents = async () => {
    const watermark = Date.now() - EMIT_DELAY;
    const batch: TelemetryEvent[] = [];

    // Pop all events with timestamp <= watermark (they're ready to emit)
    // Since it's a min-heap, events come out in timestamp order
    while (heap.length > 0 && heap.peek()!.ts <= watermark) {
        batch.push(heap.pop()!);
        // Limit batch size to avoid huge payloads
        if (batch.length >= MAX_BATCH_SIZE) {
            break;
        }
    }
    if (batch.length === 0) {
        return;
    }
    console.log(`Emitting ${batch.length} events (heap size: ${heap.length}, watermark: ${new Date(watermark).toISOString()})`);
    await fetch(INGEST_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(batch),
    });
};

const startEmitInterval = () => {
    emitIntervalRef = setInterval(emitReadyEvents, EMIT_INTERVAL);
};

const main = async () => {
    console.log(`Starting stream processor with watermark delay: ${EMIT_DELAY}ms`);
    
    const kafkaClient = new SubscribingKafkaClient([KAFKA_BROKERS]);
    await kafkaClient.start();
    
    kafkaClient.on('message', (message: TelemetryEvent) => {
        heap.push(message);
    });
    
    await kafkaClient.subscribe(KAFKA_TOPIC);
    startEmitInterval();
};

main().catch((err) => console.error(err));
