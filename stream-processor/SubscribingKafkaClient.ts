import { Consumer, Kafka, Message } from "kafkajs"
import { EventEmitter } from "eventemitter3"

interface Events {
    message: (message: Message) => void
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
    }

    async subscribe(topic: string) {
        await this.consumer.subscribe({ topic })
        await this.consumer.run({
            eachMessage: async ({ message }) => {
                this.emit('message', message)
            }
        })
    }
}