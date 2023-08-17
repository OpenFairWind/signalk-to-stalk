// navigation.position


const stalk = require('../stalk.js')
module.exports = function (app) {
	return {
		"title": "Cross Track Error",
		"period": 1000,
		"path": "navigation.course.calcValues.crossTrackError",
		"handler": function (xte) {
			
			var datagrams = []
			
			let f = 0
			
			//xte = 4833.72
			
			let xteNm = xte * 0.000539957
			let xteNm100 = parseInt(Math.round(xteNm*100))
			
			let XXX = stalk.padd(xteNm100.toString(16),3)
			
			let X6 = XXX.substring(2)+'6'
			let XX = XXX.substring(0,2)
			
			
			
			// XTE is present
			f = f | 0x01
			
			if (xteNm >= 0.3) {
				// XTE is greather or equal than 0.3 Nm
				f = f | 0x08
			}
			
			let y = 0			
			
			let YF = stalk.padd(((y << 8) | f).toString(16),2)
			let yf = stalk.padd((255-((y << 8) | f)).toString(16),2)
/*			
85  X6  XX  VU ZW ZZ YF 00 yf   Navigation to waypoint information
                  Cross Track Error: XXX/100 nautical miles
                   Example: X-track error 2.61nm => 261 dec => 0x105 => X6XX=5_10
                  Bearing to destination: (U & 0x3) * 90° + WV / 2°
                   Example: GPS course 230°=180+50=2*90 + 0x64/2 => VUZW=42_6
                   U&8: U&8 = 8 -> Bearing is true, U&8 = 0 -> Bearing is magnetic
                  Distance to destination: Distance 0-9.99nm: ZZZ/100nm, Y & 1 = 1
                                           Distance >=10.0nm: ZZZ/10 nm, Y & 1 = 0
                  Direction to steer: if Y & 4 = 4 Steer right to correct error
                                      if Y & 4 = 0 Steer left  to correct error
                  Example: Distance = 5.13nm, steer left: 5.13*100 = 513 = 0x201 => ZW ZZ YF=1_ 20 1_
                           Distance = 51.3nm, steer left: 51.3*10  = 513 = 0x201 => ZW ZZ YF=1_ 20 0_
                  F contains four flags which indicate the available data fields:
                           Bit 0 (F & 1): XTE present
                           Bit 1 (F & 2): Bearing to destination present
                           Bit 2 (F & 4): Range to destination present
                           Bit 3 (F & 8): XTE >= 0.3nm
                       These bits are used to allow a correct translation from for instance an RMB sentence which
                       contains only an XTE value, all other fields are empty. Since SeaTalk has no special value
                       for a data field to indicate a "not present" state, these flags are used to indicate the
                       presence of a value.
                   In case of a waypoint change, sentence 85, indicating the new bearing and distance,
                   should be transmitted prior to sentence 82 (which indicates the waypoint change).
                   Corresponding NMEA sentences: RMB, APB, BWR, BWC, XTE
*/		
			
      			datagram = stalk.toDatagram(['85', X6, XX, '00', '00', '00', YF,'00',yf])

			datagrams.push(datagram)
			return datagrams
		}
	}
}
