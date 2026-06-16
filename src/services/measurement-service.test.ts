import { describe, expect, it } from "vitest";

import { createMeasurement, listProjectMeasurements, softDeleteMeasurement, updateMeasurement } from "@/services/measurement-service";

describe("measurement service browser preview state", () => {
  it("keeps saved measurements visible in the local project list", async () => {
    const projectId = "preview-project-measurement-list";

    await createMeasurement({
      projectId,
      name: "园区边界测距",
      points: [
        { lng: 121.47, lat: 31.23 },
        { lng: 121.48, lat: 31.24 },
      ],
      totalDistanceMeters: 1410,
      note: "入口到出口",
    });

    const measurements = await listProjectMeasurements(projectId);

    expect(measurements[0]).toMatchObject({
      name: "园区边界测距",
      totalDistanceMeters: 1410,
      coordinateSystem: "BD09",
      note: "入口到出口",
    });
    expect(measurements[0]?.points).toHaveLength(2);
  });

  it("updates preview measurement name and note without changing geometry", async () => {
    const projectId = "preview-project-measurement-update";
    const measurement = await createMeasurement({
      projectId,
      name: "旧测距",
      points: [
        { lng: 121.47, lat: 31.23 },
        { lng: 121.49, lat: 31.25 },
      ],
      totalDistanceMeters: 2200,
    });

    const updatedMeasurement = await updateMeasurement({
      projectId,
      measurementId: measurement.id,
      name: "新测距",
      note: " 只改备注 ",
    });

    expect(updatedMeasurement).toMatchObject({
      id: measurement.id,
      name: "新测距",
      note: "只改备注",
      totalDistanceMeters: 2200,
    });
    expect(updatedMeasurement.points).toEqual(measurement.points);
  });

  it("hides soft-deleted preview measurements from lists", async () => {
    const projectId = "preview-project-measurement-delete";
    const measurement = await createMeasurement({
      projectId,
      name: "待删除测距",
      points: [
        { lng: 121.47, lat: 31.23 },
        { lng: 121.5, lat: 31.26 },
      ],
      totalDistanceMeters: 3300,
    });

    await softDeleteMeasurement(projectId, measurement.id);

    expect((await listProjectMeasurements(projectId)).some((currentMeasurement) => currentMeasurement.id === measurement.id)).toBe(false);
  });
});
