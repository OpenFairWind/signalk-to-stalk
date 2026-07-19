# Changelog

## 0.8.0

- Aligned settings terminology with the WebApp feature names.
- Clarified units and applicability for intervals, data age, calibration thresholds, and managed sources.
- Added deterministic settings ordering hints.
- Separated WebApp connection state from plugin runtime state.
- Reworked the dashboard into configured-feature, runtime-state, calibration, counters, and activity sections.
- Added complete calibration configuration and quality context.
- Added local event filtering and pause/resume controls without introducing write operations.
- Improved responsive layout, accessibility labels, and status wording.


## 0.7.0

- Add read-only calibration advisor and ST60 speed factor suggestion.
- Add rolling robust statistics, stability indication, and calibration warnings.
- Add WebApp calibration panel and settings schema.


## 0.6.0

### Breaking configuration cleanup

- Removed compatibility with all obsolete saved configuration fields and aliases.
- Unknown root and managed-feature properties now fail fast at plugin start.
- Removed the obsolete `instrumentUnits.mode` option permanently.
- Removed fixed-unit aliases such as `knots`, `mph`, and `kmh`; fixed units accept only `nautical`, `statute`, or `metric`.
- Removed `auto` from fixed speed/distance unit selection. Signal K preference discovery is selected exclusively with `source: signalKPreferences`.
- A fixed unit source now requires an explicit `speedAndDistance` value.

### WebApp consistency

- Added enabled/disabled state for every direct and managed conversion.
- Added suppression counts, per-datagram counters, output event, runtime status, history usage, and start time.
- Added waypoint bearing reference, refresh interval, maximum input age, and active/waiting/disabled states.
- Added unit source, current resolved system, and last transmission time.
- Added illumination source/path or fixed level and last transmission time.
- Added navigation lifecycle, suppression, and lifecycle records to the live activity table.
- Expanded responsive layouts for mobile and chart-table displays.


## 0.5.1

- Reworked the Signal K plugin settings schema so every visible control maps to implemented behavior.
- Added clear descriptions, units, ranges, defaults, and human-readable enum labels throughout the settings UI.
- Clarified that waypoint output is passive guidance and does not control or engage the autopilot.
- Removed non-functional wind, depth, temperature, experimental-mode, and duplicate off controls from the generated UI.
- Kept backward compatibility with previously saved unit settings.
- Fixed fixed-source unit selection so it no longer consults Signal K preferences.
- Added settings-schema and fixed-source regression tests.

## 0.5.0 - 2026-07-19

- Added managed SeaTalk `0x30` display-lamp intensity output for levels L0 through L3.
- Added automatic synchronization from a configurable Signal K numeric path.
- Added ratio, percentage, direct-level, and automatic brightness formats.
- Added fixed configuration source, optional inversion, startup transmission, change detection, duplicate suppression, and rate limiting.
- Added display-light state and events to the read-only WebApp and telemetry API.
- Added encoder, mapping, manager, schema, and lifecycle tests.

## 0.3.0

- Added managed SeaTalk `0x24` speed-and-distance unit datagram.
- Added best-effort synchronization from Signal K active unit preferences and path `displayUnits` metadata.
- Added explicit nautical, statute, and metric overrides.
- Added startup, change-detection, duplicate suppression, and optional periodic refresh controls.
- Added protection against mixed speed/distance preferences that SeaTalk cannot represent coherently.
- Added reserved wind, depth, and temperature configuration fields without emitting fabricated measurements.
- Added unit encoder, resolver, manager, lifecycle, and schema tests.

## 0.2.0 - 2026-07-19

### Added
- SeaTalk `0x82` target waypoint identifier encoding using the verified Thomas Knauf bit-field layout.
- SeaTalk `0x85` navigation-to-waypoint encoding for cross-track error, bearing, distance, direction-to-steer, reference and validity flags.
- Target selection, change, route-advance and clear lifecycle management.
- Canonical Signal K Course API paths with great-circle and rhumb-line fallbacks.
- Configurable true, magnetic or automatic bearing selection.
- Magnetic-bearing derivation from true bearing and magnetic variation.
- Periodic navigation refresh, stale-data suppression, resource/name fallback and optional clear behavior.
- Protocol and lifecycle tests for waypoint guidance.

### Safety
- Waypoint guidance remains passive. No autopilot key commands, mode changes or steering engagement are transmitted.

## 0.1.0 - 2026-07-19

### Fixed
- Emit the documented `stalkout` event instead of `seatalkOut`.
- Correct command `0x53` angle normalization and bit packing.
- Remove accidental global variables and dead imports.
- Clear subscriptions safely during stop and restart.
- Validate null, non-finite, out-of-range, and unrepresentable values.
- Carry rounded `60.00` coordinate minutes into the degree field.
- Use the exact metres-per-second to knots conversion.
- Add CR/LF sentence termination.

### Added
- Per-datagram events named `stalkout:50` through `stalkout:56`.
- Signal K plugin status and error reporting.
- Unit, protocol-vector, and lifecycle tests.
- GitHub Actions testing on supported Node.js versions.

## 0.4.0

- Added a bundled read-only Signal K WebApp for live monitoring.
- Added status, recent-event, and Server-Sent Events APIs.
- Added bounded telemetry history and per-datagram counters.
- Added graphical waypoint, bearing, distance, XTE, and unit-state views.
- Added structured emission reasons and source values for managed datagrams.
- Added responsive light/dark UI with no autopilot control surface.
