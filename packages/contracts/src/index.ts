export type UiLocale = 'en' | 'sv';
export type EntityType = 'PLACE' | 'EVENT';

export type SearchRequestV1 = {
  query: string;
  uiLocale: UiLocale;
  scopeId: string;
  location?: {
    latitude: number;
    longitude: number;
    radiusMeters?: number;
  };
  taxonomyNodeId?: string;
  entityTypes?: EntityType[];
  time?: { start: string; end: string };
  limit?: number;
};

export type CategoryCard = {
  id: string;
  slug: string;
  label: string;
};

export type PlaceCard = {
  canonicalId: string;
  type: 'PLACE';
  name: string;
  categories: CategoryCard[];
  location: { latitude: number; longitude: number; locality?: string };
  distanceMeters?: number;
  factualSummary?: string;
  hours?: { state: 'OPEN' | 'CLOSED' | 'UNKNOWN'; text?: string };
  placeStatus: 'ACTIVE' | 'TEMPORARILY_CLOSED' | 'UNKNOWN';
};

export type EventCard = {
  canonicalId: string;
  type: 'EVENT';
  title: string;
  categories: CategoryCard[];
  startsAt: string;
  endsAt?: string;
  timezone: string;
  venue: { canonicalPlaceId?: string; name: string };
  location: { latitude: number; longitude: number; locality?: string };
  distanceMeters?: number;
  status: 'SCHEDULED';
};

export type SearchResponseV1 = {
  requestId: string;
  semanticDegraded: boolean;
  metadata: { limit: number; resultCount: number };
  results: Array<PlaceCard | EventCard>;
};

export type SearchErrorResponseV1 = {
  requestId: string;
  error: {
    code: string;
    message: string;
    retryable: boolean;
  };
};

export {
  assertDestructiveDatabaseOperation,
  assertFinalEvalTarget,
  assertFinalEvalWriteOperation,
  DESTRUCTIVE_DATABASE_REFUSAL,
  FINAL_EVAL_WRITE_REFUSAL,
  type DatabaseEnvironment,
  type FinalEvalWriteOperation,
} from './database-target.ts';
