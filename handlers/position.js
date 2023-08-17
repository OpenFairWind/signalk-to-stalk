// navigation.position


const stalk = require('../stalk.js')
module.exports = function (app) {
	return {
		"title": "Position",
		"period": 1000,
		"path": "navigation.position",
		"handler": function (position) {
			
			var datagrams = []
		
			let degrees, minutes100, XX, YYYY, datagram
		
			let latitude = Math.abs(position.latitude)
			let longitude = Math.abs(position.longitude)
		
/*
50  Z2  XX  YY  YY  LAT position: XX degrees, (YYYY & 0x7FFF)/100 minutes
MSB of Y = YYYY & 0x8000 = South if set, North if cleared
Z= 0xA or 0x0 (reported for Raystar 120 GPS), meaning unknown
Stable filtered position, for raw data use command 58
Corresponding NMEA sentences: RMC, GAA, GLL
*/
			// SeaTalk1 Encoder 0x50

			degrees = Math.floor(latitude)
      			minutes100 = parseInt(Math.round(100*(latitude-degrees)*60))
      			XX = stalk.toHexString(parseInt(degrees))
      			YYYY = minutes100 & 0x7FFF
     	 		if (position.latitude<0) YYYY = YYYY | 0x8000
      			YYYY = stalk.padd(YYYY.toString(16),4)
      		
			datagram = stalk.toDatagram(['50', '02', XX, YYYY.substring(2,4), YYYY.substring(0,2)])

			datagrams.push(datagram)
			
/*
51  Z2  XX  YY  YY  LON position: XX degrees, (YYYY & 0x7FFF)/100 minutes
MSB of Y = YYYY & 0x8000 = East if set, West if cleared
Z= 0xA or 0x0 (reported for Raystar 120 GPS), meaning unknown
Stable filtered position, for raw data use command 58
Corresponding NMEA sentences: RMC, GAA, GLL
*/
			// SeaTalk1 Encoder 0x51

		
			degrees = Math.floor(longitude)
      			minutes100 = parseInt(Math.round(100*(longitude-degrees)*60))
      			XX = stalk.toHexString(parseInt(degrees))
      			YYYY = minutes100 & 0x7FFF
      			if (position.longitude>0) YYYY = YYYY | 0x8000
      			YYYY = stalk.padd(YYYY.toString(16),4)
      			datagram = stalk.toDatagram(['51', '02', XX, YYYY.substring(2,4), YYYY.substring(0,2)])

			datagrams.push(datagram)
			return datagrams
		}
	}
}
