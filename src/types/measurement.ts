import type { MapCoordinate } from "@/services/map-provider";

export interface MeasurementRecord {
  id: string;
  projectId: string;
  name: string;
  points: MapCoordinate[];
  totalDistanceMeters: number;
  coordinateSystem: "BD09";
  note: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface MeasurementDraft {
  projectId: string;
  name: string;
  points: MapCoordinate[];
  totalDistanceMeters: number;
  note?: string | null;
}

export interface MeasurementUpdate {
  projectId: string;
  measurementId: string;
  name: string;
  note?: string | null;
}
