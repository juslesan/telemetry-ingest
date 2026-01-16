import { Hono } from 'hono'
import { z } from 'zod'
import db from './db'

const app = new Hono()
const TelemetryEventSchema = z.object({
  deviceId: z.string().min(1),
  ts: z.number().int().nonnegative(), // epoch ms
  latitude: z.number().min(-90).max(90),
  longitude: z.number().min(-180).max(180)
});
const TelemetryBatchSchema = z.array(TelemetryEventSchema).min(1);

app.get('/', (c) => {
  return c.text('Hello Hono!')
});

app.post('/event', async (c) => {
  const payload = await c.req.json();
  const result = TelemetryEventSchema.safeParse(payload);
  if (!result.success) {
    return c.json({ error: result.error }, 400);
  }

  const { deviceId, ts, latitude, longitude } = result.data;

  db.prepare(
    `
      INSERT INTO telemetry_events (device_id, ts, latitude, longitude)
      VALUES (?, ?, ?, ?)
    `
  ).run(deviceId, ts, latitude, longitude);

  return c.json({ deviceId, ts, latitude, longitude });
})

app.post('/events/batch', async (c) => {
  const payload = await c.req.json();
  const parsed = TelemetryBatchSchema.safeParse(payload);

  if (!parsed.success) {
    return c.json({ error: parsed.error.flatten() }, 400);
  }

  const insert = db.prepare(
    `
      INSERT INTO telemetry_events (device_id, ts, latitude, longitude)
      VALUES (?, ?, ?, ?)
    `
  );

  const transaction = db.transaction((events: typeof parsed.data) => {
    for (const event of events) {
      insert.run(
        event.deviceId,
        event.ts,
        event.latitude,
        event.longitude
      );
    }
  });

  transaction(parsed.data);

  return c.json({ inserted: parsed.data.length });
});

app.get('/events', (c) => {
  const pageParam = c.req.query('page')
  const sizeParam = c.req.query('size')
  const pageSize = Math.min(200, Math.max(1, Number(sizeParam) || 50))
  const page = Math.max(1, Number(pageParam) || 1)
  const offset = (page - 1) * pageSize

  const totalResult = db
    .query('SELECT COUNT(*) AS count FROM telemetry_events')
    .get() as { count: number }
  const total = totalResult?.count ?? 0
  const totalPages = Math.max(1, Math.ceil(total / pageSize))

  const rows = db
    .query(
      `
        SELECT id, device_id, ts, latitude, longitude
        FROM telemetry_events
        ORDER BY id DESC
        LIMIT ?
        OFFSET ?
      `
    )
    .all(pageSize, offset) as Array<{
    id: number
    device_id: string
    ts: number
    latitude: number
    longitude: number
  }>

  const duplicateCountResult = db
    .query(
      `
        SELECT COALESCE(SUM(event_count - 1), 0) AS count
        FROM (
          SELECT COUNT(*) AS event_count
          FROM telemetry_events
          GROUP BY device_id, ts, latitude, longitude
          HAVING COUNT(*) > 1
        )
      `
    )
    .get() as { count: number } | undefined

  const outOfOrderCountResult = db
    .query(
      `
        SELECT COUNT(*) AS count
        FROM (
          SELECT ts,
            MAX(ts) OVER (
              PARTITION BY device_id
              ORDER BY id
              ROWS BETWEEN UNBOUNDED PRECEDING AND 1 PRECEDING
            ) AS max_prev
          FROM telemetry_events
        )
        WHERE max_prev IS NOT NULL AND ts < max_prev
      `
    )
    .get() as { count: number } | undefined

  const duplicateCount = duplicateCountResult?.count ?? 0
  const outOfOrderCount = outOfOrderCountResult?.count ?? 0

  const escapeHtml = (value: string) =>
    value
      .replace('&', '&amp;')
      .replace('<', '&lt;')
      .replace('>', '&gt;')
      .replace('"', '&quot;')
      .replace("'", '&#39;')

  const rowsHtml = rows
    .map((row) => {
      const deviceId = escapeHtml(row.device_id)
      return `
        <tr>
          <td>${row.id}</td>
          <td>${deviceId}</td>
          <td>${row.ts}</td>
          <td>${row.latitude}</td>
          <td>${row.longitude}</td>
        </tr>
      `
    })
    .join('')

  const previousPage = page > 1 ? page - 1 : null
  const nextPage = page < totalPages ? page + 1 : null
  const baseQuery = `size=${pageSize}`

  const html = `
    <!doctype html>
    <html lang="en">
      <head>
        <meta charset="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <title>Telemetry Events</title>
        <style>
          body { font-family: system-ui, sans-serif; padding: 24px; }
          table { border-collapse: collapse; width: 100%; }
          th, td { border: 1px solid #ddd; padding: 8px; text-align: left; }
          th { background: #f5f5f5; }
          form { margin-bottom: 16px; display: flex; gap: 12px; align-items: center; }
          label { display: flex; gap: 6px; align-items: center; }
          input { width: 80px; }
          .summary { margin-bottom: 16px; padding: 12px; background: #f8fafc; border: 1px solid #e2e8f0; }
          .summary strong { margin-right: 12px; }
          .pager { margin-top: 16px; display: flex; gap: 12px; align-items: center; }
          .pager a { text-decoration: none; color: #2563eb; }
          .pager span { color: #555; }
        </style>
      </head>
      <body>
        <h1>Telemetry Events</h1>
        <form method="get" action="/events">
          <label>
            Page
            <input type="number" name="page" min="1" value="${page}" />
          </label>
          <label>
            Size
            <input type="number" name="size" min="1" max="200" value="${pageSize}" />
          </label>
          <button type="submit">Go</button>
        </form>
        <div class="summary">
          <strong>Duplicates:</strong> ${duplicateCount}
          <strong>Out of order:</strong> ${outOfOrderCount}
        </div>
        <table>
          <thead>
            <tr>
              <th>ID</th>
              <th>Device</th>
              <th>Timestamp</th>
              <th>Latitude</th>
              <th>Longitude</th>
            </tr>
          </thead>
          <tbody>
            ${rowsHtml}
          </tbody>
        </table>
        <div class="pager">
          ${
            previousPage
              ? `<a href="/events?page=${previousPage}&${baseQuery}">Previous</a>`
              : '<span>Previous</span>'
          }
          <span>Page ${page} of ${totalPages}</span>
          ${
            nextPage
              ? `<a href="/events?page=${nextPage}&${baseQuery}">Next</a>`
              : '<span>Next</span>'
          }
        </div>
      </body>
    </html>
  `

  return c.html(html)
})

export default app
