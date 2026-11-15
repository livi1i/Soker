/** Resolve a public asset or hard navigation under the hosting directory. */
export const sitePath = (path: string) => import.meta.env.BASE_URL + path.replace(/^\//, "");
