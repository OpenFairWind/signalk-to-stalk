// navigation.position


const stalk = require('../stalk.js')
const course = require('../course.js')

module.exports = function (app) {
	return {
		"title": "Course Next Point",
		"minPeriod": 1000,
		"policy": "instant",
		//"period": 1000,
		//"policy": "ideal",
		"path": "navigation.course.nextPoint",
		"handler": function (nextPoint) {
		
			app.debug("Course Next Point: " + nextPoint)
			
			// The datagrams
			var datagrams = []
			
			// Checl if the parameter is an object
			if (nextPoint != null) {
			
				app.debug("nextPoint: " + JSON.stringify(nextPoint, null, 2))
			
				// Check if the type key ia in the object
				if ("type" in nextPoint) {

					// Set the default waypoint name
					let wptName = "0000"

					// Check if a resource reference is present
					if ("href" in nextPoint) {
					
						let waypointPath = nextPoint.href.substr(1).replaceAll("/",".")
					
						app.debug("waypointPath: " + waypointPath)
					
						// Use the waypoint name from the resource
						let waypoint = app.getSelfPath(waypointPath)
						
						app.debug("waypoint: " + JSON.stringify(waypoint, null, 2))
						
						// Check if the waypoint is valid and if it has the name key
						if (waypoint != null && "name" in waypoint) {
						
							// Get the last 4 characters of the upper case waypoint name
							wptName = waypoint.name.toUpperCase().substr(wptName.length - 4);
						}
					}
					
					app.debug("wptName: " + wptName)
					
					// Get the course data
					let oCourse = new course.Course(app)
					
					// Get the XTE from the document
					oCourse.processXTE(null)

					// Get the BTW from the document
					oCourse.processBTW(null)

					// Get the DTW from the document
					oCourse.processDTW(null)

					// Get the datagram data
					let result = oCourse.getResult()

					// Create the datagram 0x85 (course data)
      					datagram = stalk.toDatagram([
						'85', 
						stalk.toHexString(result.X6),
						stalk.toHexString(result.XX), 
						stalk.toHexString(result.VU), 
						stalk.toHexString(result.ZW),
						stalk.toHexString(result.ZZ), 
						stalk.toHexString(result.YF),
						'00',
						stalk.toHexString(result.yf)
					])

					// Add the datagram to the results
					datagrams.push(datagram)
			
					// Create a text encorder
					let utf8Encoder = new TextEncoder()
					
					// Get the waypoint name chars as an array
					let chars = utf8Encoder.encode(wptName)
					
					// Offset the charts by 0x30
					for (i = 0; i < 4; i++) chars[i] = chars[i]-0x30

					// Encode the waypoint name
					let XX = (chars[0] & 0x3f) | 
						((chars[1]<<6) & 0xc0)

					let YY = ((chars[1]>>2) & 0x0f) |
						((chars[2]<<4) & 0xf0)

					let ZZ = ((chars[2]>>4) & 0x03) |
						((chars[3]<<2) & 0xfc)

					// Compute the complement
					let xx = 0xff-XX
					let yy = 0xff-YY
					let zz = 0xff-ZZ

					// Create the datagram 0x82 (waypoint name)
					datagram = stalk.toDatagram([
						'82','05',
						stalk.toHexString(XX),
						stalk.toHexString(xx),
						stalk.toHexString(YY),
						stalk.toHexString(yy),
						stalk.toHexString(ZZ),
						stalk.toHexString(zz)
					])

					// Add the datagram to the results
					datagrams.push(datagram)
				}
			}
			return datagrams
		}
	}
}
