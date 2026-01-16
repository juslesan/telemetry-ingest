const KAFKA_BROKERS = process.env.KAFKA_BROKERS || 'redpanda:9092';
const KAFKA_TOPIC = process.env.KAFKA_TOPIC || 'telemetry-events';
const INGEST_URL = process.env.INGEST_URL || 'http://ingest-api:3000/events/batch';


// IMPLEMENTATION
