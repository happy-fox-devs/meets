---
id: reference-deploys-build-via-github-workflows-deploy-yml-to-ghcr-io
type: reference
scope: project
title: Deploys build via .github/workflows/deploy.yml to ghcr.io/happy-fox-devs/meets:latest (main) or :dev (dev branch); Dockerfile ends by running node server.js in production, never next start
triggers: ["pipeline de deploy","docker deploy meets","ghcr image name"]
anchors: [{"path":".github/workflows/deploy.yml"}]
asserted: 2026-08-02
invalidated: null
superseded_by: null
confidence: medium
pin: false
source: init
---
Workflow triggers on push to main or dev, logs into GHCR with GITHUB_TOKEN,
and does `docker build -t ghcr.io/happy-fox-devs/meets:$TAG .` where TAG is
`latest` on main and `dev` on the dev branch, then pushes. Dockerfile is a
4-stage build (base/deps/builder/runner) on `node:24-slim`, copies
public/.next/node_modules/server.js into the runner stage, and its CMD is
`["node", "server.js"]` -- confirms production also runs the custom server,
not `next start`.
