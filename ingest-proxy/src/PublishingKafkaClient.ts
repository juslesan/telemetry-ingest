import { Kafka, Partitioners, Producer } from "kafkajs"


export class PublishingKafkaClient {

    private client: Kafka
    private producer: Producer

    constructor(brokers: string[]) {
        this.client = new Kafka({
            clientId: 'ingest-proxy',
            brokers,
        })
        this.producer = this.client.producer({
            createPartitioner: Partitioners.DefaultPartitioner
        })
    }

    async start() {
        await this.producer.connect()
        console.log('Kafka producer connected')
    }

    async publish(topic: string, messages: { key: string, value: string }[]) {
        await this.producer.send({
            topic,
            messages: messages.map(({ key, value }) => ({ key, value }))
        })
    }
}
