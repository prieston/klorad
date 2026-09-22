# @klorad/docs-examples

Compiled code samples for `docs/guides/building-a-klorad-app.md`. Every non-`TARGET` block in
that guide is copied here verbatim so `pnpm typecheck` proves it against the real `@klorad/api`,
`@klorad/engine-three`, `@klorad/engine-cesium`, and `@klorad/engine-mapbox` exports.

This is not an app: it has no `dev`, `build`, or `start` script, nothing here runs, and nothing
is deployed. If the guide's code and this package drift, the guide is wrong; fix the guide, then
mirror the fix here.
