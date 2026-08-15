# Vessel test record — 2026-08-15

## Scope

Live-bus test of direct Signal K GPS and apparent-wind output through the
GadgetPool USB SeaTalk/NMEA converter. The wind datagrams were tested from the
development branch that adds encoders for SeaTalk1 commands `0x10` and `0x11`.

## System

- Signal K server: 2.31.0
- Node.js: 24.19.0
- Plugin: development build based on `signalk-to-stalk` 2.0.9
- Plugin baseline: tag `v2.0.9` from `OpenFairWind/signalk-to-stalk`
- Serial device: stable FTDI `/dev/serial/by-id/...` path
- Serial settings: 4800 baud, 8 data bits, no parity, 1 stop bit
- Independent SeaTalk1 monitor: dedicated Signal K GPIO provider

## Test configuration

The test was performed in stages. GPS datagrams were enabled and verified
first; the final wind test enabled only the apparent-wind datagrams:

| Datagram | Meaning | Minimum interval |
| --- | --- | --- |
| `0x50` | Latitude | 1000 ms |
| `0x51` | Longitude | 1000 ms |
| `0x52` | Speed over ground | 1000 ms |
| `0x54` | UTC time | 1000 ms |
| `0x56` | Date | 1000 ms |
| `0x10` | Apparent wind angle | 1000 ms |
| `0x11` | Apparent wind speed | 1000 ms |
| `0x57` | GNSS satellites and HDOP | 1000 ms |
| `0x99` | Compass variation | 1000 ms |

Datagram `0x53` (magnetic course) was enabled after a separately tested WMM
source supplied `navigation.magneticVariation`. The same preferred Signal K
path was subsequently used for `0x99`.

The Signal K connection `SeatalkBridge` was enabled with `toStdout` set to
`stalkout`. Its NMEA 0183 event injection was suppressed during the test.

The embedded Node-RED serial nodes `ST Bridge`, `BridgeTX`, and `BridgeRX` were
removed from the active flow after a backup was created. Merely setting them to
`disabled` was insufficient because the shared serial configuration node still
attempted to lock the device. All unrelated Node-RED nodes remained present,
including the TCP line buffer and GPIO SeaTalk activity processing.

## Backups and rollback

Pre-test files are stored locally on the target in a dated test-backup directory
outside this repository.

- `flows_openplotter.before-stalk-test.json`
- `settings.before-stalk-test.json`
- plugin configuration backup, if a configuration existed before the test

To roll back, stop Signal K, restore the backed-up flow and settings files,
disable or remove the test plugin configuration, and start Signal K again.
Verify that Node-RED owns the FTDI device and that its GPIO activity gate sees
SeaTalk traffic before restoring normal RMC/MWV transmission.

## Observations

The plugin debug log produced checksummed sentences at approximately 1 Hz:

```text
$STALK,50,02,0B,87,07*10
$STALK,51,02,3C,FD,0C*6A
```

The Signal K TCP stream also contained matching `$STALK` messages without NMEA
checksums. That stream combines output events and received provider data, so it
is not treated as an independent GPIO proof.

GPS position, speed over ground, date, and time were visibly confirmed on the
connected SeaTalk1 instruments. The displayed time differed from UTC by the
instrument's configured local offset; the encoded plugin value was UTC.

For the final wind test, `SeatalkBridge.toStdout` was changed from `wind_in` to
`stalkout`. The plugin then produced varying checksummed wind messages at
approximately 1 Hz, for example:

```text
$STALK,11,01,0D,08*3C
$STALK,10,01,02,98*42
```

These values represent approximately 13.8 kn apparent wind speed and 332
degrees apparent wind angle. Both wind direction and wind speed appeared and
responded on the physical SeaTalk1 wind instrument. This instrument result is
the physical end-to-end confirmation; it does not depend on interpreting the
mixed Signal K TCP stream.

After cleanup, one Signal K server process owned both the FTDI provider and the
GPIO line, and no serial lock errors occurred in the current process. The
Signal K socket and the separate health-check timer were also restored.

The later variation and GNSS-quality extension produced these frames:

```text
$STALK,99,00,10*6C
$STALK,57,90,07*61
```

Command `0x99` represents 16 degrees west. The source value was approximately
15.88 degrees west; SeaTalk1 command `0x99` carries whole degrees and uses the
opposite sign convention from Signal K. Command `0x57` represents 9 satellites
and HDOP 0.7. Generation, throttling, checksums, and forwarding through the
configured `stalkout` route were confirmed. No claim is made here that every
connected legacy display presents fields from these optional commands.

## Incident during setup

A command intended only to print the Signal K version started an unintended
second server because the CLI does not treat `--version` as a read-only version
operation. The extra process temporarily held the FTDI device and GPIO20 during
service restarts. Its exact process group was identified and terminated with
`SIGTERM`; the systemd-managed service was then restarted. Final validation
confirmed a single server process and exclusive resource ownership.

## Result

Pass for the tested paths:

```text
Signal K position
  -> signalk-to-stalk 0x50/0x51/0x52/0x54/0x56
  -> stalkout event
  -> Signal K SeatalkBridge serial provider
  -> GadgetPool converter
  -> physical SeaTalk1 bus
  -> SeaTalk1 navigation instrument

Signal K apparent wind
  -> signalk-to-stalk 0x10/0x11
  -> stalkout event
  -> Signal K SeatalkBridge serial provider
  -> GadgetPool converter
  -> physical SeaTalk1 bus
  -> SeaTalk1 wind instrument
```

This result validates position, speed over ground, UTC/date encoding, apparent
wind angle/speed, and generation of the `0x57` and `0x99` extension frames. It
does not validate presentation of `0x57`/`0x99` on every connected instrument,
source selection among competing inputs, or stale-data handling.
