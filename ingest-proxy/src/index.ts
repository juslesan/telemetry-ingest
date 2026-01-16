import { Hono } from 'hono'
import { z } from 'zod'
import { PublishingKafkaClient } from './PublishingKafkaClient'


const main = async () => {
  const kafkaClient = new PublishingKafkaClient([process.env.KAFKA_BROKERS!])
  await kafkaClient.start()
  
  const app = new Hono()
  const TelemetryEventSchema = z.object({
    deviceId: z.string().min(1),
    ts: z.number().int().nonnegative(), // epoch ms
    latitude: z.number().min(-90).max(90),
    longitude: z.number().min(-180).max(180)
  });

  app.post('/event', async (c) => {
    const payload = await c.req.json();
    const result = TelemetryEventSchema.safeParse(payload);
    if (!result.success) {
      return c.json({ error: result.error }, 400);
    }

    const { deviceId, ts, latitude, longitude } = result.data;

    await kafkaClient.publish(
      process.env.KAFKA_TOPIC!, 
      [{ 
        key: deviceId,
        value: JSON.stringify({ deviceId, ts, latitude, longitude }) 
      }]
    );
    return c.json({ deviceId, ts, latitude, longitude });
  })

}

main().catch((err) => console.error(err))
