# signalk-to-stalk

Signal K Node server plugin that converts Signal K navigation values and active waypoint guidance to SeaTalk1 datagrams wrapped in `$STALK` NMEA 0183-style sentences.

The implementation follows Signal K SI-unit conventions and Thomas Knauf's SeaTalk Technical Reference.

## Settings and monitor UX

Version 0.8.0 uses the same feature names in the Signal K settings and the read-only WebApp: direct datagram conversions, waypoint guidance, display units, display lighting, and the speed calibration advisor. The dashboard separates configured state from resolved runtime state and from WebApp connection health. Interval values are always labelled with their units. Conditional settings explain when they apply.

The activity table can be filtered or paused locally. These controls only affect the browser view and never transmit data or modify plugin configuration.


## Supported conversions

| SeaTalk command | Signal K source | Meaning |
|---|---|---|
| `0x50` | `navigation.position.latitude` | Latitude |
| `0x51` | `navigation.position.longitude` | Longitude |
| `0x52` | `navigation.speedOverGround` | Speed over ground |
| `0x53` | `navigation.courseOverGroundTrue`, `navigation.magneticVariation` | Magnetic COG |
| `0x54` | `navigation.datetime` | UTC time |
| `0x56` | `navigation.datetime` | UTC date |
| `0x82` | `navigation.course.nextPoint` and waypoint metadata | Four-character target waypoint identifier |
| `0x85` | `navigation.course.calcValues.*` | XTE, bearing and distance to target |

Legacy `navigation.courseGreatCircle.*` and `navigation.courseRhumbline.*` paths are accepted as fallbacks for waypoint guidance.

Signal K angles are radians, speed is metres per second, distances are metres, and timestamps are UTC-capable ISO-8601 values.

## Target waypoint lifecycle

Enable **Target waypoint and autopilot navigation data** to manage commands `0x82` and `0x85` as one coherent feature.

When a target is selected or advanced, the plugin waits for available navigation values and emits:

1. `0x85` with bearing, range and cross-track error;
2. `0x82` with the target identifier.

This ordering follows the SeaTalk waypoint-change rule. Subsequent calculation changes refresh `0x85` without repeatedly announcing `0x82`.

When the target is cleared, the default behavior is to emit one `0x85` with all validity flags cleared and stop periodic navigation output. Sending a fallback `0x82` during clear is optional and disabled by default.

Waypoint names are resolved, in order, from the target object, a referenced resource when available through `app.getPath`, the active route point, the waypoint resource identifier, and the configured fallback. SeaTalk supports only four encoded characters; unsupported characters are replaced deterministically and the last four characters are transmitted.

## Waypoint configuration

```json
{
  "navigationToWaypoint": {
    "enabled": true,
    "updateIntervalMs": 1000,
    "maximumAgeMs": 5000,
    "bearingReference": "magnetic",
    "waypointNameFallback": "WP",
    "sendInvalidOnClear": true,
    "sendWaypointNameOnClear": false
  }
}
```

`bearingReference` may be `magnetic`, `true`, or `auto`. In magnetic mode, a magnetic bearing is preferred; when only a true bearing and magnetic variation are available, the magnetic bearing is derived.

`maximumAgeMs` suppresses periodic output when the navigation values used in the current datagram have not been refreshed recently.

## Safety boundary

Commands `0x82` and `0x85` provide passive route guidance to compatible SeaTalk displays and autopilots. This release deliberately does **not** transmit SeaTalk autopilot key commands, engage Track/Auto mode, acknowledge waypoint advances, or alter steering state.

A helmsperson must verify route, bearing, cross-track error, waypoint transitions, and the behavior of the connected Raymarine equipment before relying on the output.


## Plugin settings UI

Version 0.6.0 aligns the Signal K configuration form and read-only WebApp with every implemented feature. The form is organized into:

- direct navigation datagrams (`0x50`, `0x51`, `0x52`, `0x53`, `0x54`, and `0x56`) with an independent minimum output interval for each command;
- passive target waypoint guidance using `0x82` and `0x85`;
- speed and distance display-unit synchronization using `0x24`;
- display illumination synchronization using `0x30`.

Every option includes its unit, valid range, default, and operational scope. Version 0.6.0 deliberately removes legacy configuration compatibility: unknown properties, obsolete modes, and old aliases are rejected at startup instead of being ignored.

Selecting **Fixed plugin setting** for display units now uses only the selected fixed SeaTalk unit system. Selecting **Signal K unit preferences** resolves the active Signal K display preference and falls back to path metadata.

## Output events

Every generated sentence is emitted on:

- `stalkout` — aggregate output event;
- `stalkout:50`, `stalkout:82`, `stalkout:85`, etc. — per-command events.

Sentences include a checksum and `CR/LF`.

## Development

```bash
npm install
npm run check
npm test
```

The test suite covers byte formatting, checksums, coordinate rollover, command vectors, waypoint-name packing, navigation validity flags, target selection/change/clear ordering, magnetic-bearing derivation, and plugin lifecycle behavior.

## References

- Signal K specification 1.8.2: <https://signalk.org/specification/1.8.2/doc/>
- Signal K Course API: <https://github.com/SignalK/signalk-server/blob/master/docs/develop/rest-api/course_api.md>
- Thomas Knauf SeaTalk Technical Reference: <https://www.thomasknauf.de/seatalk.htm>
- Signal K SeaTalk `0x82`/`0x85` parser implementation: <https://github.com/SignalK/nmea0183-signalk/commit/3b51a5497aa54bf34bd20aa440ff18a2da4b2d34>

## License

Apache-2.0

## SeaTalk instrument unit synchronization

Version 0.3.0 adds optional best-effort synchronization of the Signal K speed and distance display preferences with SeaTalk instruments using datagram `0x24`.

Enable **SeaTalk instrument unit synchronization** in the plugin configuration. With `source` set to `signalKPreferences`, the plugin first checks the Signal K Server unit-preferences API, when exposed to plugins, and then checks `displayUnits` metadata for representative speed and log paths. The following coherent combinations are supported:

| Signal K display preference | SeaTalk system |
| --- | --- |
| knots and nautical miles | nautical |
| mph and statute miles | statute |
| km/h and kilometres | metric |

SeaTalk `0x24` represents speed and distance as a single unit system. If Signal K specifies a mixed combination, such as knots with kilometres, the plugin logs the conflict and does not transmit a misleading unit command.

Example configuration:

```json
{
  "instrumentUnits": {
    "enabled": true,
    "source": "signalKPreferences",
    "speedAndDistance": "nautical",
    "sendOnStartup": true,
    "resendOnChange": true,
    "pollIntervalMs": 5000,
    "periodicRefreshSeconds": 0
  }
}
```

The datagram is emitted on both `stalkout` and `stalkout:24`. Duplicate settings are suppressed. A periodic refresh can be enabled, but is disabled by default to avoid unnecessary SeaTalk traffic.

Wind-speed, depth, and temperature unit controls are intentionally absent because those unit bits are embedded in measurement datagrams not implemented by this plugin. Signal K values remain in canonical SI units; this feature changes only display-unit signalling.

Because SeaTalk1 is an unaddressed broadcast bus and instrument firmware differs, unit synchronization is best effort. It does not guarantee that every ST-series display will persist the selected units.

## WebApp monitor

Version 0.4.0 includes a read-only Signal K WebApp. After installation and server restart, open **Signal K to SeaTalk Monitor** from the Signal K WebApps page.

The monitor shows enabled and disabled conversions, live outgoing datagrams, suppressions, errors, per-command counters, runtime status, waypoint navigation state, bearing reference, refresh and staleness settings, synchronized SeaTalk units, and display illumination source and level. Its private plugin endpoints are:

- `api/status` — current operational snapshot;
- `api/recent?limit=100` — bounded recent activity;
- `api/stream` — live Server-Sent Events.

The WebApp cannot engage an autopilot, select a waypoint, change heading, or transmit arbitrary SeaTalk bytes.

## SeaTalk display-light synchronization

Version 0.5.0 can send SeaTalk command `0x30` to synchronize the four instrument lamp levels (`L0` through `L3`). Enable **SeaTalk display-light synchronization** in the plugin configuration.

The default source is the configurable Signal K path:

```text
electrical.switches.seatalkDisplayLights.dimmingLevel
```

This is intentionally configurable because Signal K 1.8.2 does not define one universal vessel-wide display-brightness setting. The path may carry a ratio (`0..1`), percentage (`0..100`), or direct level (`0..3`). Set `valueFormat` explicitly when values could be ambiguous. A fixed configured level is also supported.

SeaTalk `0x30` is broadcast to the whole unaddressed bus, so all compatible instruments may change together. The plugin sends only on startup and genuine level changes, suppresses duplicate commands, and applies a configurable minimum interval.

## Calibration advisor

Version 0.7.0 adds a read-only WebApp calibration panel. The first advisor targets the ST60 Speed/Tridata calibration factor by comparing `navigation.speedThroughWater` with `navigation.speedOverGround` over a rolling sample window.

The displayed multiplier is:

```text
reference speed / measured speed
```

The suggested instrument value is:

```text
current ST60 factor × multiplier
```

Enter the factor currently displayed by the ST60 in the plugin settings. The advisor rejects very low-speed observations, obvious ratio outliers, and marks a suggestion ready only after the configured minimum sample count and stability threshold are satisfied.

GPS SOG is not normally equal to speed through water when current or tide is present. Raymarine recommends using Adjust to SOG only in slack tide conditions; the more reliable procedure is reciprocal outward and return runs over a measured distance. The panel is therefore advisory and never writes calibration values or sends calibration key commands.
