import { Consumer, Kafka } from "kafkajs"
import { EventEmitter } from "eventemitter3"

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

    constructor(brokers: string[]) {
        super()
        this.kafkaClient = new Kafka({
            clientId: 'stream-processor',
            brokers,
        })
        this.consumer = this.kafkaClient.consumer({ groupId: 'stream-processor' })
    }

    async start() {
        await this.consumer.connect()
        console.log('Kafka consumer connected')
    }

    async subscribe(topic: string) {
        console.log("Subscribing to topic", topic)
        await this.consumer.subscribe({ topic, fromBeginning: true })
        await this.consumer.run({
            eachMessage: async ({ message }) => {
                const jsonString = binaryToUtf8(message.value!)
                const telemetryEvent = JSON.parse(jsonString) as TelemetryEvent
                this.emit('message', telemetryEvent)
            }
        })
        console.log("Subscribed to topic", topic)
    }
}