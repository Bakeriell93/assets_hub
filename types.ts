
export type Market = string;
export type Platform = string;
export type CarModel = string;

export const MARKETS: Market[] = ['PL', 'CH', 'NL', 'DE', 'IT', 'FR'];
export const CAR_MODELS: CarModel[] = ['Seal', 'Seal 5', 'Seal 6', 'Seal U DM-i', 'Atto 2', 'Sealion 7'];
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

/** Models for a given brand; when brand is All or modelsByBrand unused, returns all models. */
export function getModelsForBrand(config: SystemConfig, brand: Brand | 'All'): CarModel[] {
  if (brand !== 'All' && config.modelsByBrand?.[brand]?.length) return config.modelsByBrand[brand];
  if (brand !== 'All') return config.models;
  if (config.modelsByBrand && Object.keys(config.modelsByBrand).length > 0) {
    const all = Object.values(config.modelsByBrand).flat();
    return [...new Set(all)];
  }
  return config.models;
}
