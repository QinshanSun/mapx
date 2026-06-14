export type MarkerSource = "manual" | "search" | "center";

export interface MarkerRecord {
  id: string;
  projectId: string;
  name: string;
  lng: number;
  lat: number;
  coordinateSystem: "BD09";
  address: string | null;
  categoryId: string | null;
  note: string | null;
  source: MarkerSource;
  createdAt: string;
  updatedAt: string;
}

export interface MarkerDraft {
  projectId: string;
  name: string;
  lng: number;
  lat: number;
  address?: string | null;
  categoryId?: string | null;
  note?: string | null;
  source?: MarkerSource;
}

export interface MarkerUpdate extends MarkerDraft {
  markerId: string;
}
