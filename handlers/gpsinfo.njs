// navigation.position


const stalk = require('../stalk.js')
module.exports = function (app) {
	return {
		"title": "GPS Info",
		"period": 10000,
		"path": "navigation.gnss.horizontalDilution",
		"handler": function (hdop) {
		
			app.debug(hdop)
			
			var datagrams = []
			

			datagrams.push(
				stalk.toDatagram(
					["A5","15","00",
					"4A","00","00","00","00"
					])
				)
			

     			datagrams.push(
				stalk.toDatagram(
					["A5","74","91",
					"8D","99","00","00"
					])
				)

     			datagrams.push(
				stalk.toDatagram(
					["A5","98","00",
					"00","00","00","00",
					"00","00","00","00"
					])
				)
				
			datagrams.push(
				stalk.toDatagram(
					["A5","B5","00",
					"04","C0","00","04","00"
					])
				)
			
      			datagrams.push(
				stalk.toDatagram(
					["A5","57","71",
					"8A","00","10","02","1F","00","00"
					])
				)

			
			return datagrams
		}
	}
}
