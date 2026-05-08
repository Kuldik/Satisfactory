// ============================================================
// Kenney Train Kit — railroad track models
// ============================================================

export const TRAIN_KIT_OBJ_DIR =
  "/kits/kenney_train-kit/Models/OBJ format/";
export const TRAIN_KIT_PREVIEW_DIR = "/kits/kenney_train-kit/Previews/";

export const RAILROAD_TRACK_MENU_ID = "railroad_track";
export const RAILROAD_STRAIGHT_MODEL_PATH = `${TRAIN_KIT_OBJ_DIR}railroad-straight.obj`;
export const RAILROAD_CORNER_LARGE_MODEL_PATH = `${TRAIN_KIT_OBJ_DIR}railroad-corner-large.obj`;
export const RAILROAD_STRAIGHT_PREVIEW_PATH = `${TRAIN_KIT_PREVIEW_DIR}railroad-straight.png`;

export function isRailroadTrackMenuId(
  id: string | null | undefined,
): boolean {
  return id === RAILROAD_TRACK_MENU_ID;
}

export function isRailroadModelPath(path: string | null | undefined): boolean {
  return !!path && path.includes("/kenney_train-kit/Models/OBJ format/railroad-");
}

export function getAllRailroadModelPaths(): string[] {
  return [RAILROAD_STRAIGHT_MODEL_PATH, RAILROAD_CORNER_LARGE_MODEL_PATH];
}
