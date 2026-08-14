import { Asset } from 'expo-asset';
import * as FileSystem from 'expo-file-system/legacy';
import activeTaxonomyAsset from '../../../reference/taxonomy/active-going-out.v1.yaml';
import { parseActiveTaxonomy, type TaxonomyNode } from './taxonomy';

export async function loadActiveTaxonomy(): Promise<TaxonomyNode[]> {
  const asset = Asset.fromModule(activeTaxonomyAsset);
  await asset.downloadAsync();
  if (!asset.localUri) throw new Error('Active taxonomy reference is unavailable.');
  return parseActiveTaxonomy(await FileSystem.readAsStringAsync(asset.localUri));
}
