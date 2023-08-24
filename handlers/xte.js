// navigation.position


const stalk = require('../stalk.js')
const course = require('../course.js')

module.exports = function (app) {
	return {
		"title": "Cross Track Error",
		"minPeriod": 1000,
		"policy": "instant",
		"path": "navigation.course.calcValues.crossTrackError",
		"handler": function (xte) {
			
			// The datagrams
			var datagrams = []

			// Get the xte as stalk parts
			let oCourse = new course.Course(app)
			oCourse.processXTE(xte)

			oCourse.processBTW(null)

			oCourse.processDTW(null)

			let result = oCourse.getResult()

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

			datagrams.push(datagram)

			return datagrams
		}
	}
}
