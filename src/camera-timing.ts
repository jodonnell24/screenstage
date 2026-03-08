import type {
  CameraMoveTiming,
  CameraMoveTimingPreset,
  CursorMoveOptions,
} from "./types.js";

export const CAMERA_MOVE_TIMINGS: Record<
  CameraMoveTimingPreset,
  Required<CameraMoveTiming>
> = {
  continuous: {
    followEnd: 1,
    followStart: 0,
    zoomEnd: 1,
    zoomStart: 0,
  },
  "depart-reveal": {
    followEnd: 0.82,
    followStart: 0,
    zoomEnd: 0.38,
    zoomStart: 0,
  },
  "late-arrival": {
    followEnd: 0.92,
    followStart: 0.12,
    zoomEnd: 1,
    zoomStart: 0.7,
  },
  settle: {
    followEnd: 1,
    followStart: 0.22,
    zoomEnd: 0.86,
    zoomStart: 0.08,
  },
};

export function createCameraMoveTiming(
  preset: CameraMoveTimingPreset,
  overrides: CameraMoveTiming = {},
): Required<CameraMoveTiming> {
  return {
    ...CAMERA_MOVE_TIMINGS[preset],
    ...overrides,
  };
}

export function resolveCameraMoveTiming(
  camera: CursorMoveOptions["camera"],
): Required<CameraMoveTiming> {
  return createCameraMoveTiming(camera?.timingPreset ?? "continuous", {
    followEnd: camera?.followEnd,
    followStart: camera?.followStart,
    zoomEnd: camera?.zoomEnd,
    zoomStart: camera?.zoomStart,
  });
}
