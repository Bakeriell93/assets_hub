
export type Market = string;
export type Platform = string;
export type CarModel = string;

export const MARKETS: Market[] = ['PL', 'CH', 'NL', 'DE', 'IT', 'FR'];
export const CAR_MODELS: CarModel[] = ['Seal', 'Seal 5', 'Seal 6', 'Seal U DM-i', 'Atto 2', 'Sealion 7'];
/** Default models for Denza brand (BYD–Mercedes JV). */
export const DENZA_MODELS: CarModel[] = ['D9', 'N7', 'N8'];
export const PLATFORMS: Platform[] = ['Google', 'Meta', 'Video', 'DOOH', 'Banner'];

export type AssetType = 'image' | 'video' | 'text' | 'design';
export type AssetStatus = 'Draft' | 'Review' | 'Approved';

export type Brand = string; // Configurable via SystemConfig.brands; default BYD, Denza
export const BRANDS: Brand[] = ['BYD', 'Denza'];

export type UsageRights = 'Fully Owned' | 'Licensed' | 'Royalty Free' | 'Social Only' | 'Internal Only';
export const USAGE_RIGHTS: UsageRights[] = ['Fully Owned', 'Licensed', 'Royalty Free', 'Social Only', 'Internal Only'];

export type AssetObjective = 'Awareness' | 'Consideration' | 'Conversion' | 'Remarketing';
export const OBJECTIVES: AssetObjective[] = ['Awareness', 'Consideration', 'Conversion', 'Remarketing'];

export type UserRole = 'Viewer' | 'Editor' | 'Admin';

export interface User {
  id: string;
  username: string;
  role: UserRole;
  fullName: string;
  password?: string;
  createdAt?: number;
  isSuperAdmin?: boolean; // True for permanent super admin (fakhri)
  /** If set, user has view access only to these markets. Empty/undefined = all markets. */
  allowedMarkets?: Market[];
}

export interface Collection {
  id: string;
  name: string;
  description?: string;
  assetIds: string[];
  parentId?: string | null; // null/undefined = top-level project; set for subfolders
  createdAt: number;
}

export interface Asset {
  id: string;
  title: string;
  description?: string;
  type: AssetType;
  status: AssetStatus;
  url?: string; 
  content?: string; 
  originalFileName?: string; // Original filename from Windows upload
  market: Market;
  platform: Platform;
  carModel: CarModel; // Keep for backward compatibility
  carModels?: CarModel[]; // New: support multiple models
  objectives: AssetObjective[];
  createdAt: number;
  uploadedBy: string;
  size?: number; // Size in bytes
  // Performance Metrics
  ctr?: number;
  cpl?: number;
  cr?: number;
  comments?: string;
  // Rights
  usageRights?: UsageRights;
  collectionIds?: string[];
  // Package grouping
  packageId?: string; // If set, this asset is part of a package
  packageOrder?: number; // Order within package
  packagePreviewAssetId?: string; // ID of the asset to use as package card preview thumbnail
  packageNote?: string; // Description of package contents (shown on card)
  packageAssetTypes?: AssetType[]; // Types included in package (e.g. image + video)
  // Brand (single for backward compat; use brands when multiple)
  brand?: Brand;
  brands?: Brand[];
  // Platforms when asset applies to multiple
  platforms?: Platform[];
  // Asset types (e.g. tagged as image + video); type is primary
  assetTypes?: AssetType[];
  // Soft delete (trash)
  deletedAt?: number; // Timestamp when asset was deleted (null/undefined = not deleted)
  /** When true (explicit), show "Contains master file" label on the asset card — not inferred from file extension */
  containsMasterFile?: boolean;
  /** When true, content is AI generated; show label on card and allow filter */
  aiGenerated?: boolean;
  /** When false, hub grid card shows no thumbnail (placeholder only). Omitted = show preview. */
  showCardPreview?: boolean;
}

export interface SystemConfig {
  markets: Market[];
  models: CarModel[];
  platforms: Platform[];
  /** When set, models are per-brand. Editors can add models and assign to brand. */
  modelsByBrand?: Partial<Record<string, CarModel[]>>;
  /** Admin-managed brand list (upload panel, filters). Defaults to BRANDS if empty. */
  brands?: Brand[];
}

/** Brands for display/filter: asset.brands or [asset.brand] when set. */
export function getAssetBrands(a: { brand?: Brand; brands?: Brand[] }): Brand[] {
  return (a.brands && a.brands.length ? a.brands : (a.brand ? [a.brand] : []));
}

/** Platforms for display/filter: asset.platforms or [asset.platform] when set. */
export function getAssetPlatforms(a: { platform?: Platform; platforms?: Platform[] }): Platform[] {
  return (a.platforms && a.platforms.length ? a.platforms : (a.platform ? [a.platform] : []));
}

/** True when this file itself is a non-previewable master/archive (type or extension only). */
export function assetIsMasterFormatFile(a: Asset): boolean {
  if (a.type === 'design') return true;
  if (a.assetTypes?.includes('design')) return true;
  const name = (a.originalFileName || a.url || '').toLowerCase();
  const ext = name.split('.').pop()?.replace(/\?.*$/, '') || '';
  return ['zip', 'rar', 'psd', 'ai', 'eps', 'pdf', 'psb'].includes(ext);
}

/** True for master-file filter / package label: explicit flag or master-format file. */
export function assetContainsMasterFile(a: Asset): boolean {
  if (a.containsMasterFile) return true;
  return assetIsMasterFormatFile(a);
}

/** Resolve package card thumbnail target from shared packagePreviewAssetId. */
export function getPackagePreviewAsset(pkgAssets: Asset[]): Asset {
  const sorted = [...pkgAssets].sort((a, b) => (a.packageOrder ?? 0) - (b.packageOrder ?? 0));
  const previewId = sorted.find(a => a.packagePreviewAssetId)?.packagePreviewAssetId;
  if (previewId) {
    return sorted.find(a => a.id === previewId) || sorted[0];
  }
  return sorted[0];
}

/** First asset in package order (card title / metadata row). */
export function getPackageLeadAsset(pkgAssets: Asset[]): Asset {
  return [...pkgAssets].sort((a, b) => (a.packageOrder ?? 0) - (b.packageOrder ?? 0))[0];
}

/** Models for a given brand; when brand is All or modelsByBrand unused, returns all models. */
export function getModelsForBrand(config: SystemConfig, brand: Brand | 'All'): CarModel[] {
  const hasBrandSpecificModels = !!config.modelsByBrand && Object.keys(config.modelsByBrand).length > 0;
  if (brand !== 'All') {
    if (hasBrandSpecificModels) return config.modelsByBrand?.[brand] ?? [];
    return config.models;
  }
  if (config.modelsByBrand && Object.keys(config.modelsByBrand).length > 0) {
    const all = Object.values(config.modelsByBrand).flat();
    if (all.length > 0) return [...new Set(all)];
  }
  return config.models;
}
