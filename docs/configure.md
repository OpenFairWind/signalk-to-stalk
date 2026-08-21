# Configure

Plugin settings are managed in the Signal K plugin settings UI. The bundled WebApp is a read-only monitor; it does not write configuration, transmit arbitrary datagrams, or control an autopilot.

The runtime validates the same types, enumerations, numeric ranges, and string lengths exposed by the settings schema. Unknown or obsolete fields are rejected. A rejected replacement configuration does not stop the currently running instance; if a valid startup later fails while creating subscriptions or managers, the partial startup is cleaned up and the plugin remains stopped rather than running incompletely.

## Direct Datagram Conversions

Each direct conversion can be enabled independently:

- `0x10` apparent wind angle;
- `0x11` apparent wind speed;
- `0x50` latitude;
- `0x51` longitude;
- `0x52` speed over ground;
- `0x53` magnetic course over ground;
- `0x54` UTC time;
- `0x56` UTC date;
- `0x57` GNSS satellite count and horizontal dilution of precision;
- `0x99` compass variation.

Each direct conversion also has a minimum output interval in milliseconds. Set the interval to `0` to emit every accepted value change.

Enable `0x10` and `0x11` together for apparent wind. Signal K apparent wind
angle is expressed in radians with negative values to port; SeaTalk `0x10`
uses a clockwise angle right of the bow in half-degree increments. Signal K
apparent wind speed is metres per second; SeaTalk `0x11` carries knots with one
decimal place. Values outside the representable SeaTalk range are rejected.

`0x57` requires both `navigation.gnss.satellites` and
`navigation.gnss.horizontalDilution`. The satellite count is limited to the
four-bit SeaTalk field and HDOP is encoded in tenths.

`0x99` converts Signal K's east-positive magnetic variation in radians to
SeaTalk's west-positive signed whole degrees. It therefore depends on a
selected, trustworthy `navigation.magneticVariation` source.

## Waypoint Guidance

Enable waypoint guidance to manage SeaTalk commands `0x82` and `0x85` as one coherent feature.

Example:

```json
{
  "navigationToWaypoint": {
    "enabled": true,
    "updateIntervalMs": 1000,
    "maximumAgeMs": 5000,
    "calculationSkewMs": 1000,
    "bearingReference": "magnetic",
    "waypointNameFallback": "WP",
    "sendInvalidOnClear": false,
    "sendWaypointNameOnClear": false
  }
}
```

When a target is selected or advanced, the plugin emits:

1. `0x85` with bearing, range, and cross-track error from a coherent navigation solution.
2. `0x82` with the matching target identifier.

Subsequent calculation changes refresh `0x85` without repeatedly announcing `0x82`.
The manager prefers fresh `navigation.course.calcValues`, then supported legacy Great Circle/Rhumbline calculations, then local great-circle geometry from `navigation.position` and `navigation.course.nextPoint.position`. A previous-point position supplies signed XTE; direct-to guidance without a leg origin uses XTE zero because no physically meaningful lateral error exists. A new waypoint name is deliberately delayed until a coherent `0x85` can be sent, preventing an ST60 from associating the new name with absent or previous guidance.

When the target is cleared, periodic navigation output stops. No invalid `0x85` is emitted because older instruments can interpret a partial or invalid frame as an error. Sending a fallback `0x82` during clear is optional and disabled by default.

### Bearing Reference

`bearingReference` may be:

- `magnetic`: prefer magnetic bearing;
- `true`: use true bearing;
- `auto`: prefer magnetic and fall back to true.

In magnetic mode, if only true bearing and magnetic variation are available, the magnetic bearing is derived. If variation is unavailable, the true bearing is transmitted with the SeaTalk true-bearing flag instead of suppressing all waypoint guidance.

Navigation frames are rate-limited to the configured refresh interval. Invalid or out-of-range distance and cross-track values are suppressed so they cannot be interpreted as alarm-like data by connected instruments.

### Stale Data

`maximumAgeMs` applies both when guidance is first established and to later refreshes. Unchanged values may be retained and refreshed only while every required calculation remains within that finite age. `calculationSkewMs` (default 1000 ms) prevents a frame from mixing distance, cross-track error, and bearing updates from different calculation cycles. Stale or incoherent snapshots suppress `0x85` and recover automatically when fresh, coherent values arrive.

Canonical `navigation.course.calcValues.*` values have priority when valid. If one is null or unavailable, the documented Great Circle and Rhumbline paths remain calculation fallbacks. In contrast, a canonical null target is an authoritative clear. The one synchronization `0x82` described above is never periodically refreshed, avoiding repeated audible waypoint behavior.

### Waypoint name visible but BTW/XTE missing

Check `navigation.course.nextPoint`, its `.position`, `navigation.position`, and (for meaningful XTE) `navigation.course.previousPoint.position`. The read-only monitor reports the selected source (`calcValues`, `legacy-course`, or `local-fallback`) and a suppression reason such as `missing-next-point-position`, `missing-vessel-position`, stale/skewed data, invalid coordinates, or a SeaTalk field-range limit. On the output side, a coherent target change must appear as `$STALK,85,...` followed by `$STALK,82,...`.

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

`resendOnChange: false` prevents preference changes from being sent even when periodic refresh polling is enabled. A configured periodic refresh may still resend the currently resolved system when its refresh period becomes due.

Wind-speed, depth, and temperature unit controls are intentionally absent because those unit bits are embedded in measurement datagrams not implemented by this plugin.

## Display Lighting

Display-light synchronization uses SeaTalk command `0x30` and supports levels `L0` through `L3`.

The default source path is:

```text
electrical.switches.seatalkDisplayLights.dimmingLevel
```

The path may carry a ratio (`0..1`), percentage (`0..100`), or direct SeaTalk level (`0..3`). Use `valueFormat` when values could be ambiguous. A fixed configured level is also supported.

The plugin sends only on startup and genuine level changes, suppresses duplicate commands, and applies the configured minimum interval. During that interval it retains only the latest requested level. If the input returns to the already-sent level, or a newer value is emitted immediately after the interval, any obsolete trailing update is cancelled.

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

`minimumSamples` must not exceed `windowSize`, and `headingMinimumSamples` must not exceed `headingWindowSize`. Configurations that could never accumulate enough samples are rejected at startup.

GPS speed over ground is not normally equal to speed through water when current or tide is present. Use the advisor only in appropriate conditions, such as slack water, or validate with reciprocal measured-distance runs.

The heading advisor compares `navigation.headingMagnetic` with `navigation.courseOverGroundTrue` corrected by `navigation.magneticVariation`. It uses circular statistics so observations around 359°/0° remain coherent, and suggests a signed alignment offset to add to the currently configured instrument offset. Samples below the configured GPS speed are rejected. Validate the result on multiple steady reciprocal headings because current, leeway, sideslip, and local compass deviation can make course over ground differ from heading.

## Removed Legacy Configuration

Current releases reject unknown root properties, obsolete managed-feature fields, invalid types, unsupported enumerations, out-of-range values, and impossible calibration sample/window combinations at startup. This is intentional: invalid saved configuration should be fixed explicitly rather than silently ignored.

`navigationToWaypoint.sendInvalidOnClear` is retained only as an explicit migration field and must be `false`. Earlier releases defaulted it on, but the resulting partial `0x85` frame is not a valid passive clear operation and can make SeaTalk instruments report data errors.
