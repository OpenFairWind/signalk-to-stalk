// navigation.position


const stalk = require('../stalk.js')
const course = require('../course.js')

module.exports = function (app) {
	return {
		"title": "Men Over Board (MOB)",
		"minPeriod": 1000,
		"policy": "instant",
		//"period": 1000,
		//"policy": "ideal",
		"path": "notifications.mob",
		"handler": function (mob) {
		
			app.debug("MOB: " + mob)
			
			// The datagrams
			var datagrams = []
			
			// Check if the parameter is an object
			if (mob != null) {
			
				app.debug("MOB: " + JSON.stringify(mob, null, 2))
			
				// Check if the state key ia in the object
				if ("state" in mob && mob.state === "emergency") {

					// Create the datagram 0x82 (Waypoint 999)
      					datagram = stalk.toDatagram([
						'82', 'A5', '40',
						'BF', '92', '6D', '24', 'DB' 
					])

					// Add the datagram to the results
					datagrams.push(datagram)
			
					// Create the datagram 0x6E (MOB)
					datagram = stalk.toDatagram([
						'6E', '07', '00',
						'00', '00', '00',
						'00', '00', '00', '00'
					])

					// Add the datagram to the results
					datagrams.push(datagram)
				}
			} else {
				// Create the datagram 0x36 (Cancel MOB)
				datagram = stalk.toDatagram([
					'36', '00', '01'
				])

				// Add the datagrams to the results
			}
			return datagrams
		}
	}
}
