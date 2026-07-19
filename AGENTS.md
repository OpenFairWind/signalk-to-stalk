# Agent Constraints

These constraints apply to coding agents working in this repository.

## Project Boundaries

- Preserve the Signal K plugin id `signalk-to-stalk`.
- Keep generated output events as `stalkout` and `stalkout:XX`.
- Treat waypoint guidance as passive. Do not add autopilot engagement, steering, key-command, or waypoint-advance acknowledgement behavior.
- Keep the bundled WebApp read-only. Browser controls may filter or pause display updates, but must not write plugin settings or transmit arbitrary SeaTalk data.
- Keep Signal K values in SI units internally. Convert only at the SeaTalk datagram boundary.

## Implementation Constraints

- Prefer adding or updating datagram modules in `datagrams/` rather than reviving the old `handlers/` architecture.
- Use shared helpers in `stalk.js` for byte formatting, checksums, coordinates, dates, and sentence generation.
- Keep stateful behavior in manager modules, not in datagram encoders.
- Preserve strict configuration validation unless a migration path is intentionally designed and tested.
- Do not silently accept obsolete configuration aliases.

## Documentation Constraints

- Keep the root `README.md` concise.
- Put detailed usage documentation in `docs/`.
- Update `docs/configure.md` whenever settings schema behavior changes.
- Update `docs/architecture.md` when runtime data flow, module ownership, or WebApp APIs change.

## Validation Constraints

- Run `npm run check` and `npm test` before committing code changes.
- Add or update tests for encoder vectors, manager lifecycle behavior, settings-schema changes, telemetry output, and WebApp read-only guarantees.
- Run `npm pack --dry-run` when package metadata or publish contents change.

## Packaging Constraints

- Keep `package.json` repository metadata aligned with `https://github.com/OpenFairWind/signalk-to-stalk`.
- Keep npm package contents controlled through the `files` whitelist.
- Do not include IDE folders, local caches, generated tarballs, or credentials in commits or published packages.
