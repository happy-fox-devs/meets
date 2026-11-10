# Versioning & deploy verification

Every push/PR to `main` must bump `"version"` in `package.json` (never merge without bumping).

`GET /api/public/health` is unauthenticated and returns `{"status":"UP","version":"<package.json version>"}`.
After pushing to `main`, poll `https://meets.nestworks.app/api/public/health` until `version` matches
what you just pushed, to confirm the new build is actually live (not just that a deploy started).
