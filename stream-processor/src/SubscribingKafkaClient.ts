import { Consumer, Kafka } from "kafkajs"
import { EventEmitter } from "eventemitter3"
import { BloomFilter } from "bloom-filters"

export interface TelemetryEvent {
    deviceId: string
    ts: number
    latitude: number
    longitude: number
}

interface Events {
    message: (message: TelemetryEvent) => void
}

const textDecoder = new TextDecoder()
const binaryToUtf8 = (bytes: Uint8Array): string => {
    return textDecoder.decode(bytes)
}

export class SubscribingKafkaClient extends EventEmitter<Events> {

    private kafkaClient: Kafka
    private consumer: Consumer
    private bloomFilter: BloomFilter

    constructor(brokers: string[]) {
        super()
        this.kafkaClient = new Kafka({
            clientId: 'stream-processor',
            brokers,
        })
        this.consumer = this.kafkaClient.consumer({ groupId: 'stream-processor' })
        this.bloomFilter = BloomFilter.create(1000000, 0.000001)
    }

    async start() {
        await this.consumer.connect()
        console.log('Kafka consumer connected')
    }

    async subscribe(topic: string) {
        console.log("Subscribing to topic", topic)
        const startTimestamp = Date.now()
        await this.consumer.subscribe({ topic })
        await this.consumer.run({
            eachMessage: async ({ message }) => {
                const jsonString = binaryToUtf8(message.value!)
                // Handle duplicate events here with the JSON string
                if (!this.bloomFilter.has(jsonString)) {
                    this.bloomFilter.add(jsonString)
                    const telemetryEvent = JSON.parse(jsonString) as TelemetryEvent
                    this.emit('message', telemetryEvent)
                }
            }
        })
        console.log("Subscribed to topic", topic, "in", Date.now() - startTimestamp, "ms")
    }
}