import type { UiLocale } from '@lemon/contracts';

export type TaxonomyNode = {
  id: string;
  slug: string;
  parentId: string | null;
  labelEn: string;
  labelSv: string;
  depth: number;
  path: string[];
};

type TaxonomyReference = {
  taxonomy_version: string;
  nodes: Array<{
    id: string;
    slug: string;
    parent_id: string | null;
    label_en: string;
    label_sv: string;
    depth: number;
    path: string[];
    active: boolean;
  }>;
};

export function parseActiveTaxonomy(text: string): TaxonomyNode[] {
  const value: unknown = JSON.parse(text);
  if (!isTaxonomyReference(value) || value.taxonomy_version !== 'active-going-out.v1') {
    throw new Error('Active taxonomy reference is invalid.');
  }
  return value.nodes
    .filter((node) => node.active)
    .map((node) => ({
      id: node.id,
      slug: node.slug,
      parentId: node.parent_id,
      labelEn: node.label_en,
      labelSv: node.label_sv,
      depth: node.depth,
      path: node.path,
    }))
    .sort((left, right) => left.path.join('/').localeCompare(right.path.join('/')));
}

export function taxonomyLabel(node: TaxonomyNode, locale: UiLocale): string {
  return locale === 'sv' ? node.labelSv : node.labelEn;
}

function isTaxonomyReference(value: unknown): value is TaxonomyReference {
  return value !== null
    && typeof value === 'object'
    && Array.isArray((value as TaxonomyReference).nodes)
    && (value as TaxonomyReference).nodes.every((node) => typeof node.id === 'string'
      && typeof node.slug === 'string'
      && (node.parent_id === null || typeof node.parent_id === 'string')
      && typeof node.label_en === 'string'
      && typeof node.label_sv === 'string'
      && Number.isInteger(node.depth)
      && Array.isArray(node.path)
      && node.path.every((id) => typeof id === 'string')
      && typeof node.active === 'boolean');
}
