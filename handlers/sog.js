// navigation.position


const stalk = require('../stalk.js')
module.exports = function (app) {
	return {
		"title": "Speed Over Ground",
		"period": 1000,
		"path": "navigation.speedOverGround",
		"handler": function (sog) {
			
			var datagrams = []

/*
52  01  XX  XX  Speed over Ground: XXXX/10 Knots
*/
			// SeaTalk1 Encoder 0x52

			let sogKn = sog*1.944
      			let sog10 = parseInt(Math.round(sogKn*10))
      			let XXXX = stalk.padd(sog10.toString(16),4)
      			let datagram = stalk.toDatagram(['52', '01', XXXX.substring(2,4), XXXX.substring(0,2)])
					
			datagrams.push(datagram)
/*
 24  02  00  00  XX  Display units for Mileage & Speed
                     XX: 00=nm/knots, 06=sm/mph, 86=km/kmh
*/
			//datagram = stalk.toDatagram(['24','02','00','00','00'])	
			
			//datagrams.push(datagram)
					
			return datagrams
		}
	}
}
