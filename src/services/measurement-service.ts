import { isTauri } from "@tauri-apps/api/core";

import { callCommand } from "@/services/tauri-client";
import type { MeasurementDraft, MeasurementRecord, MeasurementUpdate } from "@/types/measurement";

const previewNow = "2026-06-16T00:00:00Z";
const previewMeasurementsByProject = new Map<string, MeasurementRecord[]>();
let previewMeasurementCreateCount = 0;

export function listProjectMeasurements(projectId: string) {
  if (!isTauri()) {
    return Promise.resolve(getPreviewMeasurements(projectId));
  }

  return callCommand<MeasurementRecord[]>("list_project_measurements", { request: { projectId } });
}

export function createMeasurement(draft: MeasurementDraft) {
  if (!isTauri()) {
    const measurement = buildPreviewMeasurement(draft, `preview-created-measurement-${++previewMeasurementCreateCount}`);
    previewMeasurementsByProject.set(draft.projectId, [measurement, ...getPreviewMeasurements(draft.projectId)]);
    return Promise.resolve(measurement);
  }

  return callCommand<MeasurementRecord>("create_measurement", { request: draft });
}

export function updateMeasurement(update: MeasurementUpdate) {
  if (!isTauri()) {
    const existingMeasurement = getPreviewMeasurements(update.projectId).find((measurement) => measurement.id === update.measurementId);

    if (!existingMeasurement) {
      return Promise.reject(new Error("MEASUREMENT_NOT_FOUND"));
    }

    const updatedMeasurement: MeasurementRecord = {
      ...existingMeasurement,
      name: update.name.trim(),
      note: update.note?.trim() || null,
      updatedAt: previewNow,
    };
    previewMeasurementsByProject.set(
      update.projectId,
      getPreviewMeasurements(update.projectId).map((measurement) => (measurement.id === update.measurementId ? updatedMeasurement : measurement)),
    );
    return Promise.resolve(updatedMeasurement);
  }

  return callCommand<MeasurementRecord>("update_measurement", { request: update });
}

export function softDeleteMeasurement(projectId: string, measurementId: string) {
  if (!isTauri()) {
    previewMeasurementsByProject.set(
      projectId,
      getPreviewMeasurements(projectId).filter((measurement) => measurement.id !== measurementId),
    );
    return Promise.resolve();
  }

  return callCommand<void>("soft_delete_measurement", { request: { projectId, measurementId } });
}

function getPreviewMeasurements(projectId: string) {
  const existingMeasurements = previewMeasurementsByProject.get(projectId);

  if (existingMeasurements) {
    return existingMeasurements;
  }

  previewMeasurementsByProject.set(projectId, []);
  return [];
}

function buildPreviewMeasurement(draft: MeasurementDraft, measurementId: string): MeasurementRecord {
  return {
    id: measurementId,
    projectId: draft.projectId,
    name: draft.name.trim(),
    points: draft.points.map((point) => ({ lng: point.lng, lat: point.lat })),
    totalDistanceMeters: draft.totalDistanceMeters,
    coordinateSystem: "BD09",
    note: draft.note?.trim() || null,
    createdAt: previewNow,
    updatedAt: previewNow,
  };
}
