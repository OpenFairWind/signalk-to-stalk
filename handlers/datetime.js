// navigation.position


const stalk = require('../stalk.js')
module.exports = function (app) {
	return {
		"title": "Date and Time (GMT)",
		"period": 10000,
		"path": "navigation.datetime",
		"handler": function (datetime8601) {
			
			var datagrams = []
			
			let datetime = new Date(datetime8601)
			
/*
54  T1  RS  HH  GMT-time:
HH hours, 6 MSBits of RST = minutes = (RS & 0xFC) / 4
6 LSBits of RST = seconds =  ST & 0x3F
*/
			// SeaTalk1 Encoder 0x54
			
      			let HH = datetime.getUTCHours()

      			let RS = ((datetime.getUTCMinutes() * 4) & 0xfc) + ((datetime.getUTCSeconds() >> 4) & 0x03)

      			let T = datetime.getUTCSeconds() & 0x0f
      			T = (T << 4) | 0x01

      			datagram = stalk.toDatagram(['54', stalk.toHexString(T), stalk.toHexString(RS),stalk.toHexString(HH)])

			datagrams.push(datagram)

/*
56  M1  DD  YY  Date: YY year, M month, DD day in month
*/
			// SeaTalk1 Encoder 0x56
			
			let YY = datetime.getUTCFullYear()-2000
      			let DD = datetime.getUTCDate()
      			let M = 0x01 | (((datetime.getUTCMonth() + 1) << 4) & 0xf0)

      			datagram = stalk.toDatagram(['56', stalk.toHexString(M), stalk.toHexString(DD),stalk.toHexString(YY)])

			datagrams.push(datagram)
			
			return datagrams
		}
	}
}
