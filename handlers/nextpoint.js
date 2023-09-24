// navigation.position


const stalk = require('../stalk.js')
const course = require('../course.js')
const waypoint = require('../waypoint.js')

module.exports = function (app) {
	return {
		"title": "Course Next Point",
		"minPeriod": 1000,
		"policy": "instant",
		//"period": 5000,
		//"policy": "ideal",
		"path": "navigation.course.nextPoint",
		"handler": function (nextPoint) {
		
			app.debug("Course Next Point: " + nextPoint)
			
			// The datagrams
			var datagrams = []
			
			// Get the waypoint data
			let oWaypoint = new waypoint.Waypoint(app)

			// Get the next point encoding
			let result = oWaypoint.getNextPoint(nextPoint)

			// Create the datagram 0x82 (waypoint name)
                        let datagram82 = stalk.toDatagram([
                        	'82','05',
                                stalk.toHexString(result.XX),
                                stalk.toHexString(result.xx),
                                stalk.toHexString(result.YY),
                                stalk.toHexString(result.yy),
                                stalk.toHexString(result.ZZ),
                                stalk.toHexString(result.zz)
                     	])

			// Get the course data
			let oCourse = new course.Course(app)
					
			// Get the XTE from the document
			oCourse.processXTE(null)

			// Get the BTW from the document
			oCourse.processBTW(null)

			// Get the DTW from the document
			oCourse.processDTW(null)

			// Get the datagram data
			result = oCourse.getResult()

			// Create the datagram 0x85 (course data)
      			let datagram85 = stalk.toDatagram([
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
			datagrams.push(datagram82)
			datagrams.push(datagram85)
				
			return datagrams
		}
	}
}
