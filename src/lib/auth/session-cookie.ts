/** Shared cookie name. Kept dependency-free so `proxy.ts` can import it
 *  without pulling in `server-only`, the DB client, or next/headers. */
export const SESSION_COOKIE = "ims_session";
