// navigation.position


const stalk = require('../stalk.js')
module.exports = function (app) {
	return {
		"title": "Position",
		"minPeriod": 1000,
		"policy": "instant",
		"path": "navigation.position",
		"handler": function (position) {
			
			var datagrams = []
		
			let degrees, minutes100, KKYY, XX, YY, KK, datagram
		
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

			degrees = Math.floor(Math.abs(latitude))
			minutes100 = Math.round(6000.0 * (latitude-degrees))
      			KKYY = parseInt(minutes100) & 0x7fff
			
     	 		if (position.latitude<0) KKYY = KKYY | 0x8000
			
			//app.debug("latitude: " + latitude)
			//app.debug("degrees: " + degrees + " minutes100: " + minutes100)
			
			XX = parseInt(degrees) & 0xff
      			YY = KKYY & 0xff
			KK = (KKYY >> 8) & 0xff
      		
			datagram = stalk.toDatagram([
				'50', '02', 
				stalk.toHexString(XX), 
				stalk.toHexString(YY),
				stalk.toHexString(KK)
			])

			datagrams.push(datagram)
			
/*
51  Z2  XX  YY  YY  LON position: XX degrees, (YYYY & 0x7FFF)/100 minutes
MSB of Y = YYYY & 0x8000 = East if set, West if cleared
Z= 0xA or 0x0 (reported for Raystar 120 GPS), meaning unknown
Stable filtered position, for raw data use command 58
Corresponding NMEA sentences: RMC, GAA, GLL
*/
			// SeaTalk1 Encoder 0x51

			degrees = Math.abs(Math.floor(longitude))
			minutes100 = Math.round(6000.0 * (longitude-degrees))
      			KKYY = parseInt(minutes100) & 0x7fff
			
     	 		if (position.longitude>0) KKYY = KKYY | 0x8000
			
			//app.debug("longitude: " + longitude)
			//app.debug("degrees: " + degrees + " minutes100: " + minutes100)
			
			XX = parseInt(degrees) & 0xff
      			YY = KKYY & 0xff
			KK = (KKYY >> 8) & 0xff
      		
			datagram = stalk.toDatagram([
				'51', '02', 
				stalk.toHexString(XX), 
				stalk.toHexString(YY),
				stalk.toHexString(KK)
			])
		
			datagrams.push(datagram)
			return datagrams
		}
	}
}
