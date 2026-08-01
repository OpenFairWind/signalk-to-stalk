# signalk-to-stalk

Signal K Node server plugin and read-only WebApp that converts selected Signal K navigation data to SeaTalk1 datagrams wrapped in `$STALK` NMEA 0183-style sentences. Version 2.0.3 is the stable feature release for the current architecture.

The implementation follows Signal K SI-unit conventions and Thomas Knauf's SeaTalk Technical Reference.

## Features

- Direct datagram conversions for position, speed over ground, course over ground, UTC time, and UTC date.
- Passive target waypoint guidance that announces `0x82` immediately and sends `0x85` when fresh calculations are available.
- SeaTalk display-unit synchronization using command `0x24`.
- SeaTalk display-light synchronization using command `0x30`.
- Read-only WebApp monitor with runtime status, counters, recent activity, and calibration advice.

## Documentation

- [Getting started](docs/getting_started.md)
- [Install](docs/install.md)
- [Configure](docs/configure.md)
- [Architecture](docs/architecture.md)
- [Changelog](CHANGELOG.md)

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

## Safety Boundary

Commands `0x82` and `0x85` provide passive route guidance to compatible SeaTalk displays and autopilots. This plugin does **not** transmit SeaTalk autopilot key commands, engage Track or Auto mode, acknowledge waypoint advances, or alter steering state.

A helmsperson must verify route, bearing, cross-track error, waypoint transitions, and the behavior of the connected Raymarine equipment before relying on the output.

## Output events

Every generated sentence is emitted on:

- `stalkout` — aggregate output event;
- `stalkout:50`, `stalkout:82`, `stalkout:85`, etc. — per-command events.

Sentences include a checksum and `CR/LF`.

## WebApp Monitor

After installation and server restart, open **Signal K to SeaTalk Monitor** from the Signal K WebApps page.

The monitor shows configured features, runtime state, live outgoing datagrams, suppressions, errors, per-command counters, waypoint state, synchronized units, display-light state, and calibration advice. It is read-only.

## Development

```bash
npm install
npm run check
npm test
```

## References

- Signal K specification 1.8.2: <https://signalk.org/specification/1.8.2/doc/>
- Signal K Course API: <https://github.com/SignalK/signalk-server/blob/master/docs/develop/rest-api/course_api.md>
- Thomas Knauf SeaTalk Technical Reference: <https://www.thomasknauf.de/seatalk.htm>

## License

Apache-2.0
