import { Message } from "kafkajs";
import { SubscribingKafkaClient, TelemetryEvent } from "./SubscribingKafkaClient";

const KAFKA_BROKERS = process.env.KAFKA_BROKERS || 'redpanda:9092';
const KAFKA_TOPIC = process.env.KAFKA_TOPIC || 'telemetry-events';
const INGEST_URL = process.env.INGEST_URL || 'http://ingest-api:3000/events/batch';

const BATCHING_INTERVAL_MS = 1000;

let batch: TelemetryEvent[] = []
let batchingIntervalRef: NodeJS.Timeout

const sendBatch = () => {
    if (batch.length === 0) { 
        return;
    }
    console.log('Sending batch of', batch.length, 'events')
    batch.sort((a, b) => a.ts - b.ts)
    fetch(INGEST_URL, {
        method: 'POST',
        body: JSON.stringify(batch),
    })
    batch = []
}

const startBatchingInterval = () => {
    batchingIntervalRef = setInterval(() => {
        sendBatch()
    }, BATCHING_INTERVAL_MS)
}

// IMPLEMENTATION
const main = async () => {
    const kafkaClient = new SubscribingKafkaClient([KAFKA_BROKERS])
    await kafkaClient.start()
    kafkaClient.on('message', (message: TelemetryEvent) => {
        batch.push(message)
        if (batch.length >= 250) {
            clearInterval(batchingIntervalRef)
            sendBatch()
            startBatchingInterval()
        }
    })
    await kafkaClient.subscribe(KAFKA_TOPIC)
    startBatchingInterval()
}

main().catch((err) => console.error(err))
