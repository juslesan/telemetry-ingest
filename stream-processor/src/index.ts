import { Message } from "kafkajs";
import { SubscribingKafkaClient, TelemetryEvent } from "./SubscribingKafkaClient";

const KAFKA_BROKERS = process.env.KAFKA_BROKERS || 'redpanda:9092';
const KAFKA_TOPIC = process.env.KAFKA_TOPIC || 'telemetry-events';
const INGEST_URL = process.env.INGEST_URL || 'http://ingest-api:3000/events/batch';

const BATCHING_INTERVAL = Number(process.env.BATCHING_INTERVAL ?? 1000);
const MAX_BATCH_SIZE = Number(process.env.MAX_BATCH_SIZE ?? 100);

console.log('Starting stream processor with batching interval:', BATCHING_INTERVAL, 'ms and max batch size:', MAX_BATCH_SIZE)

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
    }, BATCHING_INTERVAL)
}

const main = async () => {
    const kafkaClient = new SubscribingKafkaClient([KAFKA_BROKERS])
    await kafkaClient.start()
    kafkaClient.on('message', (message: TelemetryEvent) => {
        batch.push(message)
        if (batch.length >= MAX_BATCH_SIZE) {
            clearInterval(batchingIntervalRef)
            sendBatch()
            startBatchingInterval()
        }
    })
    await kafkaClient.subscribe(KAFKA_TOPIC)
    startBatchingInterval()
}

main().catch((err) => console.error(err))
