# Agent Constraints

These constraints apply to coding agents working in this repository.

## Project Boundaries

- Preserve the Signal K plugin id `signalk-to-stalk`.
- Keep generated output events as `stalkout` and `stalkout:XX`.
- Treat waypoint guidance as passive. Do not add autopilot engagement, steering, key-command, or waypoint-advance acknowledgement behavior.
- Keep the bundled WebApp read-only. Browser controls may filter or pause display updates, but must not write plugin settings or transmit arbitrary SeaTalk data.
- Keep Signal K values in SI units internally. Convert only at the SeaTalk datagram boundary.
- Measurement datagrams must be opt-in. Never enable or recommend retransmission when the selected Signal K value originated on the same SeaTalk bus.

## Implementation Constraints

- Prefer adding or updating datagram modules in `datagrams/` rather than reviving the old `handlers/` architecture.
- Use shared helpers in `stalk.js` for byte formatting, checksums, coordinates, dates, and sentence generation.
- Keep stateful behavior in manager modules, not in datagram encoders.
- Preserve strict configuration validation unless a migration path is intentionally designed and tested.
- Do not silently accept obsolete configuration aliases.
- Validate a replacement configuration before stopping a running instance, and clean up every partial subscription, manager, interval, or timeout when startup fails.
- For rate-limited or trailing emissions, ensure the eventual output reflects the latest accepted source value; cancel obsolete pending work on reversion, replacement, and stop.
- Make boolean feature controls and manager options exact: disabled change detection must not emit changes indirectly through another polling or refresh option.
- Do not synthesize SeaTalk alarm, sensor-failure, unit, validity, average, or secondary-sensor state from a bare Signal K measurement. Clear unsupported flags or suppress the datagram, and document the choice.
- Calibration features are advisory and read-only. Wind advice must require an independent reference or a documented physical procedure; never present derived true wind as an independent calibration reference.

## Documentation Constraints

- Keep the root `README.md` concise.
- Put detailed usage documentation in `docs/`.
- Update `docs/configure.md` whenever settings schema behavior changes.
- Update `docs/architecture.md` when runtime data flow, module ownership, or WebApp APIs change.
- Document validation rules and interactions between settings, including cross-field constraints and restart behavior.

## Validation Constraints

- Run `npm run check` and `npm test` before committing code changes.
- Run `npm pack --dry-run` for every release-facing change and whenever package metadata, WebApp assets, workflows, or publish contents change.
- Add or update tests for encoder vectors, manager lifecycle behavior, settings-schema changes, telemetry output, and WebApp read-only guarantees.
- For measurement encoders, test SI conversion, byte boundaries, null suppression, malformed input, field overflow, and every flag intentionally set or cleared.
- Cover failed and repeated starts, unsubscribe failures, pending-timer replacement/cancellation, and conflicting manager options when those paths change.
- Keep `.github/workflows/test.yml` aligned with the locally required checks and supported Node.js versions.
- Do not bypass or weaken CI checks to make a change pass.

## Packaging Constraints

- Keep `package.json` repository metadata aligned with `https://github.com/OpenFairWind/signalk-to-stalk`.
- Keep npm package contents controlled through the `files` whitelist.
- Do not include IDE folders, local caches, generated tarballs, or credentials in commits or published packages.
- Keep `signalk.appIcon` relative to `public/`; use a packaged raster image of at least 72 by 72 pixels for Signal K dashboard compatibility.
- Publish only from a GitHub release tag matching `v<package.json version>` or an explicitly authorized manual workflow run.
- Keep npm credentials in the `NPM_TOKEN` GitHub Actions secret and never commit or print them.
