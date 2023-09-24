// navigation.position


const stalk = require('../stalk.js')
const course = require('../course.js')
const waypoint = require('../waypoint.js')

module.exports = function (app) {
	return {
		"title": "Distance to Waypoint",
		"minPeriod": 1000,
		"policy": "instant",
		"path": "navigation.course.calcValues.distance",
		"handler": function (dtw) {
			
			var datagrams = []

			// The result
                        let result = null

                        // Get the waypoint data
                        let oWaypoint = new waypoint.Waypoint(app)

                        // Get the next point encoding
                        result = oWaypoint.getNextPoint(null)

                        // Check if the result is valid
                        if (result != null) {

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

                                datagrams.push(datagram82)
                        }

			// Get the xte as stalk parts
			let oCourse = new course.Course(app)
			oCourse.processXTE(null)

			oCourse.processBTW(null)

			oCourse.processDTW(dtw)

			result = oCourse.getResult()

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

			
			datagrams.push(datagram85)
			return datagrams
		}
	}
}
