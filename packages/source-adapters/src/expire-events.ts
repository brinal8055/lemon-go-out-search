import pg from 'pg';

const { Client } = pg;

export type ExpireEventsReport = {
  withheld: number;
  documentsInvalidated: number;
  embeddingsStaled: number;
};

export async function expireEvents(connectionString: string): Promise<ExpireEventsReport> {
  const client = new Client({ connectionString });
  await client.connect();
  try {
    await client.query('set role lemon_ingestion');
    const result = await client.query<{
      withheld_count: number;
      documents_invalidated: number;
      embeddings_staled: number;
    }>('select * from app.expire_events()');
    const row = result.rows[0];
    if (!row) throw new Error('EVENT_EXPIRY_REPORT_MISSING');
    return {
      withheld: row.withheld_count,
      documentsInvalidated: row.documents_invalidated,
      embeddingsStaled: row.embeddings_staled,
    };
  } finally {
    await client.end();
  }
}
