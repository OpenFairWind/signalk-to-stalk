# Getting Started

`signalk-to-stalk` is a Signal K Node server plugin that converts selected Signal K navigation values to SeaTalk1 datagrams wrapped in `$STALK` NMEA 0183-style sentences.

The plugin is designed for installations that need to feed SeaTalk1-compatible equipment through a Signal K output path such as a STALK-capable NMEA 0183 provider, SeaTalk bridge, or adapter.

Version 2.0.0 is the stable release target for the current datagram-manager architecture and read-only monitor.

## What It Does

- Encodes direct navigation values such as position, speed over ground, course over ground, UTC time, and UTC date.
- Provides passive target waypoint guidance with SeaTalk commands `0x82` and `0x85`.
- Optionally synchronizes SeaTalk display speed and distance units with command `0x24`.
- Optionally synchronizes SeaTalk display lighting with command `0x30`.
- Provides a read-only WebApp monitor with runtime status, recent activity, counters, and calibration advice.

## Safety Boundary

Waypoint guidance is passive. The plugin does not send SeaTalk autopilot key commands, engage Track or Auto mode, acknowledge waypoint advances, or alter steering state.

A helmsperson must verify route, bearing, cross-track error, waypoint transitions, and connected Raymarine equipment behavior before relying on the output.

## Supported Direct Conversions

| SeaTalk command | Signal K source | Meaning |
| --- | --- | --- |
| `0x50` | `navigation.position.latitude` | Latitude |
| `0x51` | `navigation.position.longitude` | Longitude |
| `0x52` | `navigation.speedOverGround` | Speed over ground |
| `0x53` | `navigation.courseOverGroundTrue`, `navigation.magneticVariation` | Magnetic COG |
| `0x54` | `navigation.datetime` | UTC time |
| `0x56` | `navigation.datetime` | UTC date |

Waypoint guidance also uses:

| SeaTalk command | Signal K source | Meaning |
| --- | --- | --- |
| `0x82` | `navigation.course.nextPoint` and waypoint metadata | Four-character target waypoint identifier |
| `0x85` | `navigation.course.calcValues.*` | XTE, bearing, steering direction, and distance to target |

Legacy `navigation.courseGreatCircle.*` and `navigation.courseRhumbline.*` paths are accepted as fallbacks for waypoint guidance.

## Units

Signal K values remain in canonical SI units:

- angles are radians;
- speed is metres per second;
- distances are metres;
- timestamps are UTC-capable ISO-8601 values.

SeaTalk output is encoded into the unit conventions required by the target SeaTalk command.

## Output Events

Every generated sentence is emitted on:

- `stalkout` for aggregate output;
- `stalkout:50`, `stalkout:82`, `stalkout:85`, and similar per-command events.

Sentences include an NMEA checksum and `CR/LF` termination.

## First Run Checklist

1. Install the plugin in Signal K.
2. Restart the Signal K server if required by your installation method.
3. Enable only the conversions that match available Signal K paths.
4. Configure an output provider or bridge to consume the `stalkout` event.
5. Open the WebApp monitor and confirm datagrams are being emitted as expected.
6. Verify behavior on the connected instruments before operational use.

## Related Documentation

- [Install](install.md)
- [Configure](configure.md)
- [Architecture](architecture.md)
