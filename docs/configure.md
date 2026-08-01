# Configure

Plugin settings are managed in the Signal K plugin settings UI. The bundled WebApp is a read-only monitor; it does not write configuration, transmit arbitrary datagrams, or control an autopilot.

## Direct Datagram Conversions

Each direct conversion can be enabled independently:

- `0x50` latitude;
- `0x51` longitude;
- `0x52` speed over ground;
- `0x53` magnetic course over ground;
- `0x54` UTC time;
- `0x56` UTC date.

Each direct conversion also has a minimum output interval in milliseconds. Set the interval to `0` to emit every accepted value change.

## Waypoint Guidance

Enable waypoint guidance to manage SeaTalk commands `0x82` and `0x85` as one coherent feature.

Example:

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

When a target is selected or advanced, the plugin emits:

1. `0x82` immediately with the target identifier.
2. `0x85` with bearing, range, cross-track error, and validity flags when at least one supported calculated value is available and fresh.

Subsequent calculation changes refresh `0x85` without repeatedly announcing `0x82`.
A Course API calculation provider such as `@signalk/course-provider` may be needed to produce bearing, range, or cross-track error, but it is not required to announce the target waypoint. Stale or missing calculations suppress only `0x85`; they never delay a new `0x82` announcement.

When the target is cleared, the default behavior is to emit one `0x85` with all validity flags cleared and stop periodic navigation output. Sending a fallback `0x82` during clear is optional and disabled by default.

### Bearing Reference

`bearingReference` may be:

- `magnetic`: prefer magnetic bearing;
- `true`: use true bearing;
- `auto`: prefer magnetic and fall back to true.

In magnetic mode, if only true bearing and magnetic variation are available, the magnetic bearing is derived.

### Stale Data

`maximumAgeMs` suppresses `0x85` output when the calculated navigation values used in the current datagram have not been refreshed recently. Fresh calculation updates resume `0x85` output without re-announcing an unchanged target.

## Display Units

Display-unit synchronization uses SeaTalk command `0x24`.

Example:

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

With `source` set to `signalKPreferences`, the plugin checks Signal K unit preferences and falls back to `displayUnits` metadata for representative speed and log paths.

Supported coherent combinations:

| Signal K display preference | SeaTalk system |
| --- | --- |
| knots and nautical miles | `nautical` |
| mph and statute miles | `statute` |
| km/h and kilometres | `metric` |

SeaTalk `0x24` represents speed and distance as a single unit system. If Signal K specifies a mixed combination, such as knots with kilometres, the plugin logs the conflict and suppresses the command.

Wind-speed, depth, and temperature unit controls are intentionally absent because those unit bits are embedded in measurement datagrams not implemented by this plugin.

## Display Lighting

Display-light synchronization uses SeaTalk command `0x30` and supports levels `L0` through `L3`.

The default source path is:

```text
electrical.switches.seatalkDisplayLights.dimmingLevel
```

The path may carry a ratio (`0..1`), percentage (`0..100`), or direct SeaTalk level (`0..3`). Use `valueFormat` when values could be ambiguous. A fixed configured level is also supported.

The plugin sends only on startup and genuine level changes, suppresses duplicate commands, and applies the configured minimum interval.

## Calibration Advisor

The calibration advisor is read-only. It compares `navigation.speedThroughWater` with `navigation.speedOverGround` over a rolling sample window and suggests an ST60 Speed/Tridata calibration factor.

The displayed multiplier is:

```text
reference speed / measured speed
```

The suggested instrument value is:

```text
current ST60 factor * multiplier
```

The advisor rejects very low-speed observations, obvious ratio outliers, and marks a suggestion ready only after the configured minimum sample count and stability threshold are satisfied.

GPS speed over ground is not normally equal to speed through water when current or tide is present. Use the advisor only in appropriate conditions, such as slack water, or validate with reciprocal measured-distance runs.

## Removed Legacy Configuration

Current releases reject unknown root properties and obsolete managed-feature fields at startup. This is intentional: invalid saved configuration should be fixed explicitly rather than silently ignored.
