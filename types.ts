
export type Market = string;
export type Platform = string;
export type CarModel = string;

export const MARKETS: Market[] = ['PL', 'CH', 'NL', 'DE', 'IT', 'FR'];
export const CAR_MODELS: CarModel[] = ['Seal', 'Seal 5', 'Seal 6', 'Seal U DM-i', 'Atto 2', 'Sealion 7'];
export const PLATFORMS: Platform[] = ['Google', 'Meta', 'Video', 'DOOH', 'Banner'];

export type AssetType = 'image' | 'video' | 'text' | 'design';
export type AssetStatus = 'Draft' | 'Review' | 'Approved';

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
}

export interface Collection {
  id: string;
  name: string;
  description?: string;
  assetIds: string[];
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
  // Soft delete (trash)
  deletedAt?: number; // Timestamp when asset was deleted (null/undefined = not deleted)
}

export interface SystemConfig {
  markets: Market[];
  models: CarModel[];
  platforms: Platform[];
}
