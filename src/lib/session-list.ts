export const SESSIONS_PAGE_SIZE = 30;
export const SESSIONS_PAGE_MAX = 200;

export function escapeLike(value: string) {
  return value.replace(/[\\%_]/g, (character) => `\\${character}`);
}
