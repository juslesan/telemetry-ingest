import { z } from 'zod'

const configSchema = z.object({
  ingestUrl: z.string().url(),
  devices: z.number().int().positive(),
  bursts: z.number().int().positive(),
  burstSize: z.number().int().positive(),
  burstIntervalMs: z.number().int().positive(),
  baseLatitude: z.number(),
  baseLongitude: z.number(),
  duplicateRate: z.number().min(0).max(1),
  outOfOrderRate: z.number().min(0).max(1),
  maxOutOfOrderMs: z.number().int().positive()
})

const config = configSchema.parse({
  ingestUrl: process.env.INGEST_URL ?? 'http://localhost:3000/event',
  devices: Number(process.env.DEVICES ?? 5),
  bursts: Number(process.env.BURSTS ?? 10),
  burstSize: Number(process.env.BURST_SIZE ?? 100),
  burstIntervalMs: Number(process.env.BURST_INTERVAL_MS ?? 1000),
  baseLatitude: Number(process.env.BASE_LAT ?? 37.7749),
  baseLongitude: Number(process.env.BASE_LON ?? -122.4194),
  duplicateRate: Number(process.env.DUPLICATE_RATE ?? 0.05),
  outOfOrderRate: Number(process.env.OUT_OF_ORDER_RATE ?? 0.1),
  maxOutOfOrderMs: Number(process.env.MAX_OUT_OF_ORDER_MS ?? 5000)
})

type TelemetryEvent = {
  deviceId: string
  ts: number
  latitude: number
  longitude: number
}

const deviceIds = Array.from({ length: config.devices }, (_, i) => `device-${i + 1}`)
const lastTimestamps = new Map(deviceIds.map((id) => [id, 0]))

const randomOffset = (max: number) => (Math.random() * max) - max / 2
const should = (rate: number) => Math.random() < rate

const nextTimestamp = (deviceId: string) => {
  const previous = lastTimestamps.get(deviceId) ?? 0
  const now = Date.now()
  const next = Math.max(now, previous + 1)
  lastTimestamps.set(deviceId, next)
  return next
}

const createEvent = (deviceId: string): TelemetryEvent => {
  const baseTs = nextTimestamp(deviceId)
  const ts = should(config.outOfOrderRate)
    ? baseTs - (Math.floor(Math.random() * config.maxOutOfOrderMs) + 1)
    : baseTs

  return {
    deviceId,
    ts,
    latitude: config.baseLatitude + randomOffset(0.02),
    longitude: config.baseLongitude + randomOffset(0.02)
  }
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

const sendEvent = async (event: TelemetryEvent, burstIndex: number, eventIndex: number) => {
  const response = await fetch(config.ingestUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(event)
  })

  if (!response.ok) {
    const errorText = await response.text()
    throw new Error(
      `Burst ${burstIndex + 1} event ${eventIndex + 1} failed: ${response.status} ${errorText}`
    )
  }
}

const sendBurst = async (burstIndex: number) => {
  const events: TelemetryEvent[] = []

  for (let i = 0; i < config.burstSize; i += 1) {
    const deviceId = deviceIds[Math.floor(Math.random() * deviceIds.length)]
    const event = createEvent(deviceId)
    events.push(event)

    if (should(config.duplicateRate)) {
      events.push({ ...event })
    }
  }

  await Promise.all(events.map((event, index) => sendEvent(event, burstIndex, index)))
  console.log(
    `Burst ${burstIndex + 1}/${config.bursts} -> sent ${events.length} events`
  )
}

const run = async () => {
  console.log('Starting load generator with config:', config)

  for (let i = 0; i < config.bursts; i += 1) {
    await sendBurst(i)
    if (i < config.bursts - 1) {
      await sleep(config.burstIntervalMs)
    }
  }

  console.log('Load generation complete.')
}

run().catch((error) => {
  console.error('Load generator failed:', error)
  process.exitCode = 1
})
