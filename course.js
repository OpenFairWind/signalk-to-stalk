
const Course = class {

	constructor(app) {
		this.app = app
	
		// Steering flag
		this.Y = 0
	
		// Content flag: 
		this.F = 0
	
		// Most significative byte
		this.XX = 0
	
		// Less significative nibble
		this.X = 0
	
		// Most significative byte
		this.ZZ = 0

		// Less significative nibble
		this.Z = 0

		this.U = 0
		this.V = 0
	}

	getResult() {
		let YF = ((this.Y<<4) & 0xf0) | (this.F & 0x0f)
		let result = {
			X6: this.X | 0x06,
			XX: this.XX,
			
			// Assemble vu
			VU: (this.V << 4) | this.U,
			
			// Assemble zw
			ZW: this.Z | (this.W >> 4),
			
			// Assemble steering and flags bytes
			YF: YF,
			yf: 0xff - YF 
		}
		return result
	}

	processXTE(xte) {
	
		// Check if the passed parameter is null
		if (xte == null) {
	
			// Get XTE from the document
			xte = this.app.getSelfPath("navigation.course.calcValues.crossTrackError")
			
			// Check if the element is a valid signalk value object
			if (xte != null && "value" in xte) {
			
				// Get the value
				xte = xte.value
			}
			
		}
	
		// Check if the valu is not null
		if (xte != null) {
			
			// Content flag: only XTE is present
			this.F = this.f | 0x01
			
			// Check the steering correction
			if (xte > 0) {
				this.Y = this.Y | 0x08
			}
			
			// Convert the xte in positive nautical miles
			let xteNm = Math.abs(xte * 0.000539957)
			
			this.app.debug("xteNm: " + xteNm + " Nm")
			
			// Check if the XTE is greater or equal than 0.3 Nm
			if (xteNm >= 0.3) {
			
				// XTE is greater or equal than 0.3 Nm
				this.F = this.F | 0x08
			}
			
			// Multiply the nautical miles by 100 as an integer
			let xteNm100 = parseInt(Math.round(xteNm*100.0))
			
			xteNm100 = (xteNm100 | 0xf000) & 0x0fff
			
			//app.debug("xteNm100: " + xteNm100 + " " + stalk.padd(xteNm100.toString(2), 12))
			
			// Most significative byte
			this.XX = (xteNm100 & 0xff0) >> 4
			
			// Less significative nibble
			this.X = ((xteNm100 & 0x00f) << 4)
		}
	}
	
			
	processBTW(btw) {
	
		// Check if the passed parameter is null
		if (btw == null) {
			// Get BTW from the document
			btw = this.app.getSelfPath("navigation.course.calcValues.bearingTrue")
			
			// Check if the element is a valid signalk value object
			if (btw != null && "value" in btw) {
			
				// Get the value
				btw = btw.value
			}
			//
		}
		
		// Check if the value is not null
		if (btw != null) {
			
			// Content flags: BTW is present
			this.F = this.f | 0x02
			
			
			//btw = 4.01424183
			
			// Calculate btw in North degrees
			let btwN = parseInt(Math.round(btw*57.296))
      			if (btwN>=360) btwN=btwN-360
      			if (btwN<0) btwN=btwN+360
			
			this.app.debug("btwN: " + btwN + " deg")
			
			// Get the number of 90 degrees (0 to 3)
      			this.U = parseInt(Math.floor(btwN / 90.0)) & 0x03
			
			// Bearing is true
			this.U = this.U | 0x08
			
			// Get the ramains in terms of half degrees
			let WV = parseInt(Math.round((btwN - (90.0 * this.U))*2.0))
			
			// Get the msn
			this.V = WV & 0x0f
			
			// Get the lsn
			this.W = WV & 0xf0
			
			
		}	
	}	

	processDTW(dtw) {
		// Check if the passed parameter is null
		if (dtw == null) {
			// Get DTW from the document
			dtw = this.app.getSelfPath("navigation.course.calcValues.distance")
			
			// Check if the element is a valid signalk value object
			if (dtw != null && "value" in dtw) {
			
				// Get the value
				dtw = dtw.value
			}
			
			//
		}
		
		// Check if the value is not null
		if (dtw != null) {
		
			// Content flag: only DTW is present
			this.F = this.F | 0x04
			
			// Convert the dtw in nautical miles
			let dtwNm = dtw * 0.000539957
			
			//let dtwNm=51.3
			
			this.app.debug("dtwNm: " + dtwNm + " Nm")
			
			// Calculate the scaled dtw
			let dtwNm100or10
			
			// Scale the dtw
			if (dtwNm >=0 && dtwNm <9.99) {
				dtwNm100or10 = dtwNm * 100
				this.Y = this.Y | 0x01
			} else {
				dtwNm100or10 = dtwNm * 10
			}
			
			// Convert the scaled dtw in an integer
			dtwNm100or10 = parseInt(Math.round(dtwNm100or10))
			
			dtwNm100or10 = (dtwNm100or10 | 0xf000) & 0x0fff
			
			// Most significative byte
			this.ZZ = (dtwNm100or10 & 0xff0) >> 4
			
			// Less significative nibble
			this.Z = (dtwNm100or10 & 0x00f) << 4

		}		
	}
}

module.exports = {
	Course: Course
}
