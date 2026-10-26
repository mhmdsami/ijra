import { MAX_IMAGES_PER_SESSION, MAX_IMAGES_PER_USER_PER_DAY } from "./images.ts";

export interface ImageInsertInput {
  id: string;
  sessionId: string;
  ownerId: string;
  mime: string;
  width: number | null;
  height: number | null;
  bytes: Uint8Array;
  createdAt: number;
  dayStart: number;
}

/**
 * Inserts an image only while both storage caps hold: images per session and
 * images per owning user since the UTC day start. Counting in the same statement
 * stops concurrent uploads from both passing a pre-check.
 */
export function imageInsertStatement(input: ImageInsertInput) {
  return {
    sql: `INSERT INTO images (id, session_id, mime, width, height, bytes, created_at)
     SELECT ?, ?, ?, ?, ?, ?, ?
     WHERE (SELECT COUNT(*) FROM images WHERE session_id = ?) < ?
       AND (
         SELECT COUNT(*) FROM images i
         JOIN sessions s ON s.id = i.session_id
         WHERE s.owner_id = ? AND i.created_at >= ?
       ) < ?`,
    binds: [
      input.id,
      input.sessionId,
      input.mime,
      input.width,
      input.height,
      input.bytes,
      input.createdAt,
      input.sessionId,
      MAX_IMAGES_PER_SESSION,
      input.ownerId,
      input.dayStart,
      MAX_IMAGES_PER_USER_PER_DAY,
    ],
  };
}
