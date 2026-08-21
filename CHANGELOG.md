# Changelog

## Unreleased

### Added

- Added apparent wind angle (`0x10`) and speed (`0x11`) encoders with Signal K
  unit and port/starboard conversion, range validation, and encoder vectors.
- Added compass variation (`0x99`) with explicit Signal K east-positive to
  SeaTalk west-positive conversion and range validation.
- Added GNSS satellites and HDOP (`0x57`) with packed satellite count and
  tenths-of-HDOP encoding.
- Add GitHub Actions CI across supported Node.js versions and npm publishing CD with package validation, release-tag verification, and provenance.

### Documentation

- Added the 2026-08-15 vessel test record for the first successful live-bus
  `0x50`/`0x51` GPS position test through the GadgetPool converter and the
  independent GPIO20 receiver.
- Added a complete decision matrix for all commands documented by Thomas Knauf
  revision 3.22, including implementation status, exclusions, and safety
  boundaries.

### Fixed

- Make the WebApp icon visible in the Signal K dashboard by using a packaged 72×72 PNG and a `public/`-relative `signalk.appIcon` path.

## 2.0.10 - 2026-08-21

### Added

- Add pure great-circle geometry for local distance, true bearing, and signed cross-track-error fallback during Freeboard-SK direct-to navigation.
- Report the active navigation source and precise guidance-suppression reasons through existing read-only telemetry.

### Fixed

- Make Freeboard-SK direct-to guidance self-sufficient when Course API calculations are absent but vessel and destination positions are available.
- Delay new waypoint announcements until a coherent passive `0x85` frame can be emitted, preserving the required `0x85` then `0x82` sequence and preventing stale target/navigation associations.
- Fall back from stale or skewed authoritative calculations to fresh coherent local geometry when possible.
- Make SeaTalk `0x85` distance quantization deterministic at the 10 nm resolution boundary while preserving passive mode `F=5`.
- Preserve the latest rate-limited display-light request for a trailing emission and cancel pending emissions on shutdown.
- Interpret Signal K `dimmingLevel` value `1.0` as 100 percent brightness in automatic mode while retaining explicit raw-level mode.

## 2.0.9 - 2026-08-11

### Fixed

- Suppress stale or mixed-generation `0x85` guidance, allow legacy calculation fallbacks when canonical values are null, and send at most one `0x82` synchronization after delayed navigation establishment.

## 2.0.8 - 2026-08-07

### Fixed

- Stop retransmitting waypoint-change command `0x82` during periodic guidance refreshes, avoiding repeated audible waypoint behavior and unnecessary SeaTalk bus traffic.
- Discard cached navigation calculations when a destination is cleared or replaced so bearing, XTE, and distance from an old waypoint cannot be emitted for a new one.
- Continue refreshing the complete passive mode-5 `0x85` frame for bearing, XTE, distance, and highway displays.

## 2.0.7 - 2026-08-03

### Fixed

- Keep the active waypoint announcement alive by periodically refreshing command `0x82`.
- Refresh established passive navigation as a coherent `0x85` followed by `0x82`, preserving waypoint, bearing, cross-track error, distance, and highway pages on SeaTalk instruments.
- Retain the last complete navigation calculation while its target remains active so Signal K streams that suppress unchanged values do not cause SeaTalk displays to time out.
- Stop retained guidance immediately when Signal K clears or replaces the destination.

## 2.0.6 - 2026-08-03

### Fixed

- Fall back to a correctly flagged true waypoint bearing when magnetic variation is unavailable, restoring waypoint, bearing, XTE, and highway data on affected installations.
- Rate-limit `0x85` calculation updates and suppress out-of-range guidance to avoid SeaTalk bus bursts and alarm-like corrupted instrument indications.

## 2.0.5 - 2026-08-02

### Fixed

- Corrected SeaTalk1 `0x85` framing by emitting its required complement byte and complete passive mode-5 navigation data.
- Send navigation data before the `0x82` waypoint announcement on target changes, as required by SeaTalk1 receivers.
- Suppress malformed partial and clear-state `0x85` frames that could cause random alarms, no-data indications, or corrupted instrument values.
- Added a regression vector from real Freeboard Signal K course data.

### Added

- Added a read-only ST60 heading-alignment advisor using circular statistics, variation-corrected GPS course, minimum-speed filtering, sample thresholds, and stability reporting.
- Added heading-calibration settings, telemetry, WebApp presentation, documentation, and regression coverage.

## 2.0.4

### Fixed

- Announce SeaTalk1 `0x82` immediately when a Signal K destination is selected, without waiting for Course API bearing, distance, or cross-track calculations.
- Decouple `0x82` target announcements from `0x85` calculation availability and freshness.
- Improve duplicate suppression, waypoint transitions, name upgrades, diagnostics, and regression coverage.

## 2.0.3

- Prevented duplicate waypoint announcements when identical navigation updates arrive from multiple subscriptions.
- Corrected the read-only monitor telemetry API paths.

## 2.0.2

- Added complete live indicator coverage for every implemented SeaTalk datagram.
- Added latest sentence, bytes, timestamp, and process-count telemetry for each command.
- Added a new accessible and maskable Signal K to SeaTalk WebApp icon.
- Expanded WebApp and telemetry regression coverage while preserving read-only operation.

## 2.0.1

- Maintenance release aligning Signal K host-contract coverage and package metadata.

## 2.0.0

- Promoted the aligned feature set to the 2.0.0 release target.
- Hardened the read-only WebApp against malformed stream events and failed API responses.
- Improved monitor accessibility, focus states, mobile wrapping, and compact dashboard spacing.
- Closed telemetry stream clients on plugin stop so monitor sessions reconnect cleanly after restarts.
- Kept plugin identity, output events, passive waypoint behavior, and strict configuration validation stable.

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
