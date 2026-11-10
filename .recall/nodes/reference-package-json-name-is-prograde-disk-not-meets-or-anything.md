---
id: reference-package-json-name-is-prograde-disk-not-meets-or-anything
type: reference
scope: project
title: package.json name is 'prograde-disk', not 'meets' or anything NestWorks-branded
triggers: ["nombre del paquete prograde-disk","package.json name mismatch","por que se llama prograde-disk"]
anchors: [{"path":"package.json","symbol":"name"}]
asserted: 2026-08-02
invalidated: null
superseded_by: null
confidence: medium
pin: false
source: init
---
`package.json`'s "name" field is "prograde-disk" -- an apparently arbitrary
create-next-app default-style name, unrelated to "meets" or "NestWorks".
Searching a lockfile/registry/monorepo tooling for "meets" by package name
won't find this repo; the directory name (NestWorks/meets) and the GHCR image
name (ghcr.io/happy-fox-devs/meets) are the only "meets"-branded identifiers.
