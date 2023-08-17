// navigation.position


const stalk = require('../stalk.js')
module.exports = function (app) {
	return {
		"title": "Bearing to Waypoint (True)",
		"period": 1000,
		"path": "navigation.course.calcValues.bearingTrue",
		"handler": function (btw) {
			
			var datagrams = []
			
			let f = 0
			
			
			//btw = 4.01424183
			
			
			let mcd = Math.round(btw*57.296)
      			if (mcd>=360) mcd=mcd-360
      			if (mcd<0) mcd=mcd+360
			
      			let u = Math.floor(mcd / 90.0) 
      			let vw = Math.round((mcd - (90.0 * u))*2.0)
			
			let VW = stalk.padd(vw.toString(16),2)
			
			// Bearing is true
			u = u | 0x08
			
			let U = u.toString(16)
			
			let VU = VW.substring(1)+U
			
			let y = 0
			
			// Bearing to destination is present
			f = f | 0x02
			
			let W = VW.substring(0,1)
			
			
			let ZW = '0'+W
			
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
			
      			datagram = stalk.toDatagram(['85', '06', '00', VU, ZW, '00', YF,'00',yf])

			datagrams.push(datagram)
			return datagrams
		}
	}
}
