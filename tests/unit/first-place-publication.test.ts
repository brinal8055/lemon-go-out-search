import { describe, expect, it } from 'vitest';
import { buildFirstPlaceDocument } from '../../packages/ingestion-domain/src/index.ts';

const taxonomy = {
  id: '15904283-fd01-5fc3-ac00-c42e62e8422e',
  slug: 'dining',
  label_en: 'Dining',
  label_sv: 'Restauranger',
};

describe('DAY1-PUB-01 first Place document', () => {
  it('produces the same content identity for the same evidence-grounded inputs', () => {
    const first = buildFirstPlaceDocument('entity-1', 'Evergreen Restaurang & Pizzeria', [], taxonomy);
    const second = buildFirstPlaceDocument('entity-1', 'Evergreen Restaurang & Pizzeria', [], taxonomy);

    expect(second).toEqual(first);
    expect(first.contentHash).toMatch(/^[0-9a-f]{64}$/);
  });

  it('changes the content hash when document truth changes', () => {
    const first = buildFirstPlaceDocument('entity-1', 'Evergreen Restaurang & Pizzeria', [], taxonomy);
    const changed = buildFirstPlaceDocument('entity-1', 'Evergreen Restaurang', [], taxonomy);

    expect(changed.contentHash).not.toBe(first.contentHash);
  });

  it('contains only the canonical name, taxonomy labels, and explicit OSM fact', () => {
    const document = buildFirstPlaceDocument('entity-1', 'Evergreen Restaurang & Pizzeria', [], taxonomy);

    expect(document.descriptionText).toBe('');
    expect(document.eventContextText).toBe('');
    expect(document.aliasesText).toBe('');
    expect(document.factsText).toBe('amenity=restaurant');
    expect(document.embeddingText).toBe(
      'Evergreen Restaurang & Pizzeria\nDining\nRestauranger\namenity=restaurant',
    );
  });
});
