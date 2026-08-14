import pg from 'pg';
import type { QueryResultRow } from 'pg';

export async function fixtureQuery<T extends QueryResultRow>(
  connectionString: string,
  query: string,
  values: unknown[] = [],
): Promise<T[]> {
  const client = new pg.Client({ connectionString });
  await client.connect();
  try {
    return (await client.query<T>(query, values)).rows;
  } finally {
    await client.end();
  }
}
