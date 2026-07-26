export const SEARCH_INDEX_QUEUE = 'search-index';

export const SEARCH_INDEX_NAME = 'daladrop';

export type SearchEntityKind =
  | 'store'
  | 'product'
  | 'event'
  | 'merchant'
  | 'category';

export const SEARCH_ENTITY_KINDS: readonly SearchEntityKind[] = [
  'store',
  'product',
  'event',
  'merchant',
  'category',
] as const;

export type SearchIndexJobName = 'index' | 'remove' | 'reindex-all';

export type SearchIndexJob =
  | { readonly kind: SearchEntityKind; readonly id: string }
  | { readonly kinds?: readonly SearchEntityKind[] };
