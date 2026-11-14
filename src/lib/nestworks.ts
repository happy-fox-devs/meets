// Single source of truth for where every exit of this service leads: NestWorks itself. Its /authorize sends a signed-in
// person to their own dashboard and anyone else to the login. NEXT_PUBLIC_NESTWORKS_URL is inlined at build time.
export const NESTWORKS_EXIT_URL = `${process.env.NEXT_PUBLIC_NESTWORKS_URL ?? "https://nestworks.app"}/authorize`;
