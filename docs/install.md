# Install

## Requirements

- Signal K Node server.
- Node.js 18 or newer.
- A SeaTalk1/STALK output path that can consume `$STALK` NMEA 0183-style sentences emitted by Signal K.

## Install From npm

When published, install the package in the usual Signal K plugin workflow:

```bash
npm install signalk-to-stalk
```

Then restart the Signal K server if your installation flow does not restart it automatically.

## Install From Source

Clone the repository and install dependencies:

```bash
git clone https://github.com/OpenFairWind/signalk-to-stalk.git
cd signalk-to-stalk
npm install
```

For development validation:

```bash
npm run check
npm test
```

## Signal K Output Wiring

The plugin emits generated `$STALK` sentences on the `stalkout` event. Configure your Signal K output provider, serial adapter, or bridge to consume that event.

For serial output, a provider configuration usually needs an option equivalent to:

```json
{
  "toStdout": "stalkout"
}
```

The exact location of this setting depends on the Signal K provider or adapter being used.

## Digital Yacht ST2USB and Similar Adapters

If you are using a Digital Yacht SeaTalk1 to NMEA 0183 or SeaTalk to USB interface, configure the adapter for STALK mode and the baud rate required by that adapter. Many STALK-mode setups use 38400 baud rather than classic 4800 baud NMEA 0183.

## WebApp Monitor

After installation and server restart, open **Signal K to SeaTalk Monitor** from the Signal K WebApps page. The monitor is read-only and cannot send commands or modify plugin settings.

## Packaging Check

Before publishing a release, verify package contents:

```bash
npm pack --dry-run
```

If the local npm cache has permission issues, use a temporary cache:

```bash
npm --cache /private/tmp/signalk-to-stalk-npm-cache pack --dry-run
```
