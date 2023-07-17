// Import https://baconjs.github.io
const Bacon = require('baconjs')


// From the stalk.js file, import: toDatagram, computeChecksum, toHexString, and padd functions
const {
  toDatagram,
  computeChecksum,
  toHexString,
  padd
} = require('./stalk')

// Import path module
const path = require('path')

// Import file system module
const fs = require('fs')

// Load the datagrams from the datagrams folder
function loadDatagrams (app, plugin) {

  // Define where the datagrams are located
  const fpath = path.join(__dirname, 'datagrams')

  // Return the datagrams dictionary:
  // datagram name as a key, datagram definition as value
  return fs
      // Read the directory synchronously
      .readdirSync(fpath)

      // Filter only the .js files
      .filter(filename => filename.endsWith('.js'))

      // For each file in the directory
      .reduce((acc, fname) => {

        // Get the datagram basename removing .js
        let datagram = path.basename(fname, '.js')

        // Import the module defining the datagram
        acc[datagram] = require(path.join(fpath, datagram))(app, plugin)

        // Return the datagram definition
        return acc
      }, {})
}

// Get the throttle property name by the datagram key
const getThrottlePropname = (key) => `${key}_throttle`

// Add the datagrams to the configuration schema
function buildSchemaFromDatagrams (plugin) {

  // For each key in the datagrams dictionary...
  Object.keys(plugin.datagrams).forEach(key => {

    // Get the datagram key
    let datagram = plugin.datagrams[key]

    // Get the name of the throttle property
    const throttlePropname = getThrottlePropname(key)

    // Add the enable/disable datagram entry in the configuration schema
    plugin.schema.properties[key] = {
      title: datagram['title'],
      type: 'boolean',
      default: false
    }

    // Add the throttle datagram entry in the configuration schema
    plugin.schema.properties[throttlePropname] = {
      title: `${key} throttle ms`,
      type: 'number',
      default: datagram['throttle']
    }
  })
}

// Define the plugin
module.exports = function (app) {

  // Plugin data
  let plugin = {

    // The list of subscriptions that have to be unsubscribed when the plugin ends
    unsubscribes: []
  }

  // Plugin in
  plugin.id = 'sk-to-stalk'

  // Plugin name
  plugin.name = 'Convert Signal K to STALK'

  // Plugin description
  plugin.description = 'Plugin to convert Signal K data to STALK (SeaTalk over NMEA0183)'

  // Plugin configuration schema
  plugin.schema = {
    type: 'object',
    title: 'Conversions to STALK',
    description:
      'If there is SK data for the conversion generate the following SeaTalk datagrams from Signal K data:',
    properties: {
      "event_identifier": {
        type: 'string',
        title: "Event identifier",
        default: "seatalkOut"
      }
    }
  }

  // Load the datagrams from the datagrams directory
  plugin.datagrams = loadDatagrams(app, plugin)

  // Add the datagrams to the configuration schema
  buildSchemaFromDatagrams(plugin)

  // Define the start callback - called by the framework when the plugin starts
  plugin.start = function (options) {

    // The self context
    const selfContext = 'vessels.' + app.selfId

    // Select only the delta matching with self
    const selfMatcher = delta => delta.context && delta.context === selfContext

    //
    function mapToStalk (encoder, throttle) {

        // Display a debug message
	    app.debug(encoder.datagram)

        // Define the Signal K self streams produced by the datagram keys (i.e. "navigation.position")
        const selfStreams =

            // For each datagram key
            encoder.keys.map((key, index) => {

              // Get the self stream from the framework
              let stream = app.streambundle.getSelfStream(key)

              // Check if the encoder defaults are consistent
              if (encoder.defaults && typeof encoder.defaults[index] != 'undefined') {

                // Create the stream
                stream = stream.merge(Bacon.once(encoder.defaults[index]))
              }

              // Return the stream
              return stream

            }, app.streambundle)

      // Get the datagram function handler ("g0xHH", where HH is the hex code of the datagram)
      const sentenceEvent = encoder.datagram ? `g${encoder.datagram}` : undefined

      // Define the Signal k stream associated with the datagram
      let stream = Bacon.combineWith(function () {
        try {
          // Associate the datagram function handler to the stream
          return encoder.f.apply(this, arguments)
        } catch (e) {
          // Show a console error
          console.error(e.message)
        }
      }, selfStreams)
          // Filter only the consistent results
        .filter(v => typeof v !== 'undefined')

          // Get only the changed values
        .changes()

          // Avoid values repeated for less than 20ms
        .debounceImmediate(20)

      // Check if throttle is defined
      if (throttle) {

        // Define the stream throttle
        stream = stream.throttle(throttle)
      }

      // Add the datagram handler to the plugin
      plugin.unsubscribes.push(
        stream
          .onValue(datagramString => {

            // Emit the event on the associated ST2USB device
            app.emit(options["event_identifier"], datagramString)

            // Check if the sentence event is defined
            if (sentenceEvent) {

              // Emit the event
              app.emit(sentenceEvent, datagramString)
            }

            // Display a debug message
            app.debug(datagramString)
          })
      )
    }

    // For each key in the datagram dictionary
    Object.keys(plugin.datagrams).forEach(name => {

      // Check if the datagram is enabled
      if (options[name]) {

        // Map the datagram
        mapToStalk(plugin.datagrams[name], options[getThrottlePropname(name)])
      }
    })
  }

  // Define the stop callback - called by the framework when the plugin ends
  plugin.stop = function () {
    // Unsubscribe each datagram handler
    plugin.unsubscribes.forEach(f => f())
  }

  // Return the plugin to the framework
  return plugin
}
