# Architecture

`signalk-to-stalk` is organized around small datagram encoders plus manager modules for stateful features.

## Runtime Entry Point

`index.js` exports the Signal K plugin factory. It:

- creates the plugin object and settings schema;
- loads datagram modules from `datagrams/`;
- starts and stops subscriptions and managers;
- emits generated sentences on `stalkout` and per-command events;
- registers read-only WebApp API routes.

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

- `waypoint-manager.js` tracks active targets, waypoint names, stale navigation values, periodic refresh, and clear behavior.
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
  -> freshness and bearing-reference selection
  -> periodic or change-driven 0x85 guidance
```

The waypoint manager owns the active identity, resolved and announced names, calculation availability, suppression reason, and last emission times. It emits only complete, range-checked and rate-limited `0x85` guidance frames and, on a target change, sends `0x85` before `0x82` as required by SeaTalk. Magnetic mode safely falls back to a correctly flagged true bearing when variation is unavailable. A better name for the same stable identity produces one replacement announcement; repeated equivalent updates do not. Target clearing does not fabricate an invalid partial navigation frame.

Canonical `navigation.course.nextPoint` state is authoritative once that path has emitted. In particular, a canonical null clears the target even if a legacy path retains an older value. Before the canonical path has emitted, the first usable legacy great-circle or rhumb-line value is accepted. This avoids combining a current canonical target with stale legacy state.

## Telemetry and WebApp

`telemetry.js` keeps bounded recent events, counters, the last emitted sentence and bytes for every observed datagram, runtime state, resolved feature state, and configuration summaries. It also serves Server-Sent Events clients. Signal K mounts these read-only endpoints at `/plugins/signalk-to-stalk/api/status`, `/plugins/signalk-to-stalk/api/recent`, and `/plugins/signalk-to-stalk/api/stream`; the WebApp is mounted separately at `/signalk-to-stalk`.

The WebApp in `public/` consumes:

- `api/status` for current operational state;
- `api/recent?limit=100` for bounded recent activity;
- `api/stream` for live events.

The WebApp renders an indicator for every implemented SeaTalk command, including commands that are disabled or have not emitted yet. Each indicator combines its configured state with the process counter and latest observed datagram. The WebApp is deliberately read-only. Local filtering and pause controls affect only browser rendering.

## Schema Generation

The settings schema is generated from datagram metadata and explicit managed-feature schemas in `index.js`.

The root schema has `additionalProperties: false`, and managed feature sections also reject unknown properties. This prevents obsolete or misspelled settings from producing unclear runtime behavior.

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
