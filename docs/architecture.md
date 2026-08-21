# Architecture

`signalk-to-stalk` is organized around small datagram encoders plus manager modules for stateful features.

## Runtime Entry Point

`index.js` exports the Signal K plugin factory. It:

- creates the plugin object and settings schema;
- loads datagram modules from `datagrams/`;
- starts and stops subscriptions and managers;
- emits generated sentences on `stalkout` and per-command events;
- registers read-only WebApp API routes.

Replacement settings are validated before the active runtime is stopped. Startup is transactional with respect to subscriptions and managers: if setup throws after partial initialization, `stop()` removes the partial resources and leaves a stopped runtime instead of a mixed configuration.

## Datagram Encoders

Each file in `datagrams/` exports a factory for one SeaTalk command. Direct datagram modules define:

- `datagram`: command identifier such as `0x50`;
- `title`: human-readable settings label;
- `keys`: Signal K stream paths used by the encoder;
- optional defaults;
- `f(...)`: encoder function returning a complete `$STALK` sentence or `undefined`.

Managed datagrams, such as `0x24`, `0x30`, `0x82`, and `0x85`, are used by manager modules instead of being exposed as simple direct subscriptions.

## Shared STALK Helpers

`stalk.js` contains the shared byte, checksum, coordinate, date, and sentence-formatting helpers. Encoders should use these helpers rather than duplicating byte formatting or checksum logic.

## Managers

Stateful features live in manager modules:

- `waypoint-manager.js` tracks active targets, waypoint names, source priority, stale navigation values, periodic refresh, and clear behavior. `navigation-geometry.js` provides pure great-circle DTW/BTW/XTE fallback calculations.
- `units-manager.js` resolves Signal K display preferences or fixed settings and emits coherent `0x24` unit updates.
- `lights-manager.js` maps Signal K or configured brightness values to SeaTalk `0x30` lamp levels.
- `calibration-manager.js` maintains independent rolling speed and circular heading samples and publishes read-only calibration advice through telemetry.

Managers receive the Signal K `app`, an `emitDatagram` callback when they transmit, feature options, and telemetry.

Waypoint guidance has two independent flows:

```text
navigation.course.nextPoint
  -> stable target identity and display-name resolution
  -> duplicate-suppressed 0x82 announcement

navigation.course.calcValues.*
  -> field-specific fallback, freshness, timestamp coherence and bearing-reference selection
  -> periodic or change-driven 0x85 guidance
```

The waypoint manager owns the active identity, resolved and announced names, calculation availability, suppression reason, source, and last emission times. It selects fresh canonical calculations, then legacy calculations, then coherent local geometry. It emits only complete, fresh, timestamp-coherent, range-checked and rate-limited `0x85` guidance frames. A new target is never announced alone: the sequence is always `0x85` then `0x82`. Periodic refresh emits only `0x85`. Target clear or replacement discards cached calculations and resets synchronization state. Magnetic mode safely falls back to a correctly flagged true bearing when variation is unavailable. Target clearing does not fabricate an invalid partial navigation frame.

Canonical `navigation.course.nextPoint` state is authoritative once that path has emitted. In particular, a canonical null clears the target even if a legacy path retains an older value. Before the canonical path has emitted, the first usable legacy great-circle or rhumb-line value is accepted. This avoids combining a current canonical target with stale legacy state.

Calculation selection deliberately differs: a valid canonical `navigation.course.calcValues.*` entry wins, but a canonical null permits a valid legacy Great Circle or Rhumbline fallback.

## Telemetry and WebApp

`telemetry.js` keeps bounded recent events, counters, the last emitted sentence and bytes for every observed datagram, runtime state, resolved feature state, and configuration summaries. Its `startedAt` value is assigned whenever a stopped runtime becomes running, so it identifies the current run rather than plugin construction time. It also serves Server-Sent Events clients. Signal K mounts these read-only endpoints at `/plugins/signalk-to-stalk/api/status`, `/plugins/signalk-to-stalk/api/recent`, and `/plugins/signalk-to-stalk/api/stream`; the WebApp is mounted separately at `/signalk-to-stalk`.

The WebApp in `public/` consumes:

- `api/status` for current operational state;
- `api/recent?limit=100` for bounded recent activity;
- `api/stream` for live events.

The WebApp renders an indicator for every implemented SeaTalk command, including commands that are disabled or have not emitted yet. Each indicator combines its configured state with the process counter and latest observed datagram. The WebApp is deliberately read-only. Local filtering and pause controls affect only browser rendering.

Signal K resolves `signalk.appIcon` relative to `public/`. Package metadata therefore points to the 72×72 PNG dashboard asset as `./icon-72x72.png`; `public/icon.svg` remains the scalable browser favicon and maskable manifest icon.

## Schema Generation

The settings schema is generated from datagram metadata and explicit managed-feature schemas in `index.js`.

The root schema has `additionalProperties: false`, and managed feature sections also reject unknown properties. Runtime validation walks the generated schema and enforces its object, boolean, string, integer, number, enum, length, and range constraints. Cross-field checks additionally require fixed unit selections and attainable calibration sample counts. This prevents obsolete, misspelled, or structurally invalid settings from producing unclear runtime behavior.

## Data Flow

```text
Signal K streams
  -> direct datagram encoders or managed feature managers
  -> stalk.js sentence helpers
  -> emitDatagram()
  -> telemetry record
  -> app.emit("stalkout", sentence)
  -> app.emit("stalkout:XX", sentence)
```

## Development Checks

Run both checks before committing changes:

```bash
npm run check
npm test
```

Use focused tests for behavior changes. Add broader regression coverage when changing shared helpers, schema generation, telemetry, or manager lifecycle behavior.

GitHub Actions runs the syntax checks, tests, and package dry run across the supported Node.js matrix. The release workflow repeats validation and publishes to npm only after checking that a GitHub release tag matches the package version.
