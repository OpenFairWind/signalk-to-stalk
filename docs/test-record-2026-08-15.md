# Vessel test record — 2026-08-15

## Scope

First live-bus test of direct Signal K GPS position output through the
GadgetPool USB SeaTalk/NMEA converter. Wind output was not tested because
version 2.0.9 has no wind encoders.

## System

- Signal K server: 2.31.0
- Node.js: 24.19.0
- Plugin: `signalk-to-stalk` 2.0.9
- Plugin baseline: tag `v2.0.9` from `OpenFairWind/signalk-to-stalk`
- Serial device: stable FTDI `/dev/serial/by-id/...` path
- Serial settings: 4800 baud, 8 data bits, no parity, 1 stop bit
- Independent SeaTalk1 monitor: dedicated Signal K GPIO provider

## Test configuration

Only these plugin datagrams were enabled:

| Datagram | Meaning | Minimum interval |
| --- | --- | --- |
| `0x50` | Latitude | 1000 ms |
| `0x51` | Longitude | 1000 ms |

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

The independent GPIO receiver observed the corresponding physical-bus
datagrams without NMEA checksums:

```text
$STALK,50,02,0B,87,07
$STALK,51,02,3C,FD,0C
```

Other existing SeaTalk1 traffic remained visible in the same GPIO capture.
After cleanup, one Signal K server process owned both the FTDI provider and the
GPIO line, and no serial lock errors occurred in the current process.

## Incident during setup

A command intended only to print the Signal K version started an unintended
second server because the CLI does not treat `--version` as a read-only version
operation. The extra process temporarily held the FTDI device and GPIO20 during
service restarts. Its exact process group was identified and terminated with
`SIGTERM`; the systemd-managed service was then restarted. Final validation
confirmed a single server process and exclusive resource ownership.

## Result

Pass for the tested path:

```text
Signal K position
  -> signalk-to-stalk 0x50/0x51
  -> stalkout event
  -> Signal K SeatalkBridge serial provider
  -> GadgetPool converter
  -> physical SeaTalk1 bus
  -> independent GPIO20 receiver
```

This result validates GPS position only. It does not yet validate speed, course,
date/time, source selection, stale-data handling, or wind output.
