export type RefreshMode = 'COMPLETE_SNAPSHOT' | 'PAGINATED_SNAPSHOT' | 'DELTA_ONLY';
export type CaptureClass = 'NEW' | 'CHANGED' | 'UNCHANGED';
export type RunStatus = 'SUCCEEDED' | 'PARTIAL' | 'FAILED';

export type SourceObservation = {
  externalKey: string;
  sourceUrl: string | null;
  httpEtag?: string | null;
  httpLastModified?: string | null;
  fetchedAt: string;
  observedAt: string;
  envelope: Record<string, unknown>;
};

export type FetchResult = {
  observations: SourceObservation[];
  refreshUnitComplete: boolean;
  snapshotComplete: boolean | null;
  fetchMeta: Record<string, string | number | null>;
};

export type PlaceCandidate = {
  entityType: 'PLACE';
  canonicalName: string;
  latitude: number;
  longitude: number;
  status: 'ACTIVE' | 'TEMPORARILY_CLOSED' | 'CLOSED' | 'UNKNOWN';
  streetAddress?: string;
  postalCode?: string;
  locality?: string;
  taxonomySlug?: string;
  resolution: 'NEW' | 'UNRESOLVED';
};

export type NormalizedSourceRecord = {
  sourceKey: string;
  externalKey: string;
  entityType: 'PLACE';
  observedAt: string;
  names: Array<{ value: string; language: 'en' | 'sv' | 'und'; kind: 'OFFICIAL' }>;
  place: PlaceCandidate;
  sourceCategories: string[];
  explicitFacts: Record<string, unknown>;
  permittedEvidenceRefs: string[];
};

export type AdapterConfig = {
  sourceKey: string;
  sourceName: string;
  scopeSlug: string;
  adapterVersion: string;
  parserVersion: string;
  mappingVersion: string;
  refreshMode: RefreshMode;
};

export interface SourceAdapter {
  readonly config: AdapterConfig;
  fetch(input: { signal: AbortSignal }): Promise<FetchResult>;
  externalStableId(raw: SourceObservation): string;
  captureEnvelope(raw: SourceObservation): Record<string, unknown>;
  parse(captured: Record<string, unknown>, observation: SourceObservation): NormalizedSourceRecord;
}

export type RunCounters = {
  fetched: number;
  valid: number;
  invalid: number;
  newCount: number;
  changed: number;
  unchanged: number;
  unresolved: number;
  disappeared: number;
  canonicalApplied: number;
  published: number;
};

export type SourceEvidenceExecution = {
  sourceRecordId: string;
  sourceRecordVersionId: string;
  sourceRecordParseAttemptId: string;
};

export type CaptureOutcome = {
  sourceRecordId: string;
  sourceRecordVersionId: string;
  classification: CaptureClass;
  contentHash: string;
  expectedCurrentVersionId: string | null;
  expectedCurrentParseAttemptId: string | null;
  selectedParserVersion: string | null;
};

export type ResolutionOutcome =
  | { kind: 'EXISTING'; canonicalEntityId: string }
  | { kind: 'NEW' }
  | { kind: 'UNRESOLVED' };

export type ProjectionOutcome = {
  searchDocument: 'PENDING';
  embedding: 'PENDING';
  publication: 'PENDING';
};

export type RunResult = {
  runId: string;
  status: RunStatus;
  counters: RunCounters;
  projectionOutcomes: ProjectionOutcome[];
  stageTrace: StageTrace[];
};

export type StageName =
  | 'fetch'
  | 'capture/version'
  | 'parse/validate'
  | 'resolve'
  | 'canonical/taxonomy'
  | 'projection/publication';

export type StageTrace = {
  stage: StageName;
  externalKey: string | null;
  outcome: string;
};

export type StartRunInput = {
  idempotencyKey: string;
  config: AdapterConfig;
  retryOfRunId: string | null;
  snapshotKey: string | null;
};

export type FinishRunInput = {
  runId: string;
  status: RunStatus;
  refreshMode: RefreshMode;
  refreshUnitComplete: boolean;
  snapshotComplete: boolean | null;
  counters: RunCounters;
  observedExternalKeys: string[];
  errorCode?: string;
};

export interface IngestionStore {
  startRun(input: StartRunInput): Promise<string>;
  capture(runId: string, config: AdapterConfig, observation: SourceObservation, envelope: Record<string, unknown>): Promise<CaptureOutcome>;
  beginParseAttempt(runId: string, versionId: string, parserVersion: string): Promise<string>;
  failParseAttempt(attemptId: string, errorClass: string, errorCode: string): Promise<void>;
  succeedParseAttemptAndSelect(input: {
    runId: string;
    parserVersion: string;
    attemptId: string;
    capture: CaptureOutcome;
    normalized: NormalizedSourceRecord;
  }): Promise<SourceEvidenceExecution>;
  readSelectedNormalized(evidence: SourceEvidenceExecution): Promise<NormalizedSourceRecord>;
  resolve(evidence: SourceEvidenceExecution, candidate: NormalizedSourceRecord): Promise<ResolutionOutcome>;
  applyCanonical(input: {
    evidence: SourceEvidenceExecution;
    candidate: NormalizedSourceRecord;
    mappingVersion: string;
    beforeCommit: () => Promise<ProjectionOutcome>;
  }): Promise<{
    canonicalEntityId: string;
    canonicalChanged: boolean;
    projection: ProjectionOutcome | null;
  }>;
  finishRun(input: FinishRunInput): Promise<number>;
  close(): Promise<void>;
}

export class FixtureParseError extends Error {
  readonly code: string;

  constructor(code: string, message: string) {
    super(message);
    this.name = 'FixtureParseError';
    this.code = code;
  }
}

export class IngestionRunError extends Error {
  readonly runId: string;
  readonly counters: RunCounters;

  constructor(runId: string, counters: RunCounters, cause: unknown) {
    super(cause instanceof Error ? cause.message : 'ingestion run failed', { cause });
    this.name = 'IngestionRunError';
    this.runId = runId;
    this.counters = counters;
  }
}
