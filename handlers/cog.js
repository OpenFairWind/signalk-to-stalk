// navigation.position


const stalk = require('../stalk.js')
module.exports = function (app) {
	return {
		"title": "Course Over Ground (Magnetic)",
		"period": 1000,
		"path": "navigation.courseOverGroundMagnetic",
		"handler": function (cog) {
			
			var datagrams = []

/*
53  U0  VW      Magnetic Course in degrees:
The two lower  bits of  U * 90 +
the six lower  bits of VW *  2 +
the two higher bits of  U /  2 =
(U & 0x3) * 90 + (VW & 0x3F) * 2 + (U & 0xC) / 8
The Magnetic Course may be offset by the Compass Variation (see datagram 99) to get the Course Over Ground (COG).
*/
			// SeaTalk1 Encoder 0x53

			
			let mcd = Math.round(cog*57.296)
      			if (mcd>=360) mcd=mcd-360
      			if (mcd<0) mcd=mcd+360
      			let u1 = (mcd / 90.0) & 0x03
      			let u2 = (stalk.fmod(mcd,2.0)*8.0) & 0x0c
      			let vw = (stalk.fmod(mcd,90.0)/2.0) & 0x3f
      			let u = ((u1+u2) << 4) & 0xf0
			
      			datagram = stalk.toDatagram(['53', stalk.toHexString(u), stalk.toHexString(vw)])
		
			datagrams.push(datagram)
			
			return datagrams
		}
	}
}
