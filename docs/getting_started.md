# Getting Started

`signalk-to-stalk` is a Signal K Node server plugin that converts selected Signal K navigation values to SeaTalk1 datagrams wrapped in `$STALK` NMEA 0183-style sentences.

The plugin is designed for installations that need to feed SeaTalk1-compatible equipment through a Signal K output path such as a STALK-capable NMEA 0183 provider, SeaTalk bridge, or adapter.

Version 2.0.11 is the stable release target for the current datagram-manager architecture and read-only monitor.

## What It Does

- Encodes direct navigation values such as position, speed over ground, course over ground, UTC time, and UTC date.
- Provides passive target waypoint guidance with SeaTalk commands `0x82` and `0x85`.
- Optionally synchronizes SeaTalk display speed and distance units with command `0x24`.
- Optionally synchronizes SeaTalk display lighting with command `0x30`.
- Provides a read-only WebApp monitor with runtime status, recent activity, counters, and speed and heading calibration advice.

## Safety Boundary

Waypoint guidance is passive. The plugin does not send SeaTalk autopilot key commands, engage Track or Auto mode, acknowledge waypoint advances, or alter steering state.

A helmsperson must verify route, bearing, cross-track error, waypoint transitions, and connected Raymarine equipment behavior before relying on the output.

## Supported Direct Conversions

| SeaTalk command | Signal K source | Meaning |
| --- | --- | --- |
| `0x10` | `environment.wind.angleApparent` | Apparent wind angle |
| `0x11` | `environment.wind.speedApparent` | Apparent wind speed |
| `0x50` | `navigation.position.latitude` | Latitude |
| `0x51` | `navigation.position.longitude` | Longitude |
| `0x52` | `navigation.speedOverGround` | Speed over ground |
| `0x53` | `navigation.courseOverGroundTrue`, `navigation.magneticVariation` | Magnetic COG |
| `0x54` | `navigation.datetime` | UTC time |
| `0x56` | `navigation.datetime` | UTC date |
| `0x57` | `navigation.gnss.satellites`, `navigation.gnss.horizontalDilution` | GNSS satellites and HDOP |
| `0x99` | `navigation.magneticVariation` | Compass variation |

Waypoint guidance also uses:

| SeaTalk command | Signal K source | Meaning |
| --- | --- | --- |
| `0x82` | `navigation.course.nextPoint` and waypoint metadata | Four-character target waypoint identifier |
| `0x85` | Course calculations, or vessel/target positions as fallback | XTE, bearing, steering direction, and distance to target |

Legacy `navigation.courseGreatCircle.*` and `navigation.courseRhumbline.*` paths are accepted as fallbacks for waypoint guidance.

For Freeboard-SK **Navigate To**, the flow is Freeboard → Signal K Course API → this plugin → SeaTalk `0x85` → `0x82` → ST60. If Course API calculation values are absent, vessel and target positions are sufficient for local DTW/BTW; a previous-point position additionally provides signed XTE.

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
