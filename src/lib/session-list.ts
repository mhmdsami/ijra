export const SESSIONS_PAGE_SIZE = 30;
export const SESSIONS_PAGE_MAX = 200;

/** Escapes LIKE wildcards so user input is matched literally. */
export function escapeLike(value: string) {
  return value.replace(/[\\%_]/g, (character) => `\\${character}`);
}
