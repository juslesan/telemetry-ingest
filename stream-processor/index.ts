import { Message } from "kafkajs";
import { SubscribingKafkaClient } from "./SubscribingKafkaClient";

const KAFKA_BROKERS = process.env.KAFKA_BROKERS || 'redpanda:9092';
const KAFKA_TOPIC = process.env.KAFKA_TOPIC || 'telemetry-events';
const INGEST_URL = process.env.INGEST_URL || 'http://ingest-api:3000/events/batch';


// IMPLEMENTATION
const main = async () => {
    const kafkaClient = new SubscribingKafkaClient([KAFKA_BROKERS])
    await kafkaClient.start()
    await kafkaClient.subscribe(KAFKA_TOPIC)
    let batch: Message[] = []
    kafkaClient.on('message', (message: Message) => {
        console.log({ message })
        batch.push(message)
        if (batch.length >= 100) {
            fetch(INGEST_URL, {
                method: 'POST',
                body: JSON.stringify(batch),
            })
            batch = []
        }
    })
}

main().catch((err) => console.error(err))
