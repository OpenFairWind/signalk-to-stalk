// From the stalk.js file, import: toDatagram, computeChecksum, toHexString, a>
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

// Load the handlers from the handlers folder
function loadHandlers (app, plugin) {

  // Define where the handlers are located
  const fpath = path.join(__dirname, 'handlers')

  // Return the handlers dictionary:
  // handler name as a key, handler definition as value
  return fs
      // Read the directory synchronously
      .readdirSync(fpath)

      // Filter only the .js files
      .filter(filename => filename.endsWith('.js'))

      // For each file in the directory
      .reduce((acc, fname) => {

        // Import the module defining the handler
        handler = require(path.join(fpath, fname))(app, plugin)
	
	// Add the enable/disable handler entry in the configuration schema
	plugin.schema.properties[handler.path] = {
		title: handler['title'],
      		type: 'boolean',
		default: false
	}


	acc[handler.path] = handler

        // Return the handler definition
        return acc
      }, {})
}

module.exports = function (app) {

	var plugin = {
		id: 'signalk-to-stalk-plugin',
		name: 'Convert Signal K to STALK',
		description: 'Signal K server plugin to convert Signal K to STALK',
		schema: {
			type: 'object',
    			title: 'Conversions to STALK',
    			description: 'If there is SK data for the conversion generate the following SeaTalk datagrams',
    			properties: {
      				"event_identifier": {
        				type: 'string',
        				title: "Event identifier",
        				default: "seatalkOut"
      				}
    			}
		},
		unsubscribes: []
  	};

	plugin.start = function (options, restartPlugin) {
		// Here we put our plugin logic
   		app.debug('Plugin started');
		
		// Load the datagrams from the datagrams directory
		plugin.handlers = loadHandlers(app, plugin)

		 
		var subscribes = []
		
		Object.keys(plugin.handlers).forEach( key => {
			if (options[key]) {
				subscribes.push( {
					path: key,
					period: plugin.handlers[key].period
				})
			}
		}) 

		let localSubscription = {
    			context: 'vessels.' + app.selfId, // Get data for all contexts
    			subscribe: subscribes
  		};

		app.subscriptionmanager.subscribe(
			localSubscription,
			plugin.unsubscribes,
			subscriptionError => {
				app.error('Error:' + subscriptionError);
			},
    			delta => {
      				delta.updates.forEach(u => {
					u.values.forEach(v => {
					
						if (v.path in plugin.handlers) {
						
							let datagrams = plugin.handlers[v.path].handler(v.value)
							
							datagrams.forEach( datagram => {
								app.debug(datagram)
								// Emit the event on the associated ST2USB device
            							app.emit(options["event_identifier"], datagram)

							})
						
						}
					});
      				});
    			}
  		);
	};

	plugin.stop = function () {
		// Here we put logic we need when the plugin stops
		app.debug('Plugin stopped');

		plugin.unsubscribes.forEach(f => f());
  		plugin.unsubscribes = [];
	};

	return plugin;
};

