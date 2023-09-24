
const Waypoint = class {

	constructor(app) {
		this.app = app
	}

	getNextPoint(nextPoint) {

		let result = null

		// Check if the passed parameter is null
                if (nextPoint == null) {
        
                        // Get next point from the document
                        nextPoint = this.app.getSelfPath("navigation.course.nextPoint")

			nextPoint = {
  "position": {
    "latitude": 40.73828992568383,
    "longitude": 14.396506046788804
  },
  "type": "Location"
}

			this.app.debug("nextPoint: " + nextPoint)
                }

		// Check if the parameter is an object
                if (nextPoint != null) {

                	this.app.debug("nextPoint: " + JSON.stringify(nextPoint, null, 2))

                       	// Check if the type key ia in the object
                        if ("type" in nextPoint) {

                        	// Set the default waypoint name
                        	let wptName = "0001"

                         	// Check if a resource reference is present
                         	if ("href" in nextPoint) {

					// Get the waypoint path
                         		let waypointPath = nextPoint.href.substr(1).replaceAll("/",".")

                                	this.app.debug("waypointPath: " + waypointPath)

                                	// Use the waypoint name from the resource
                                	let waypoint = app.getSelfPath(waypointPath)

                                	this.app.debug("waypoint: " + JSON.stringify(waypoint, null, 2))

                                	// Check if the waypoint is valid and if it has the name key
                                	if (waypoint != null && "name" in waypoint) {

						// Get the last 4 characters of the upper case waypoint name
                                        	wptName = waypoint.name.toUpperCase().substr(wptName.length - 4);
                                	}
                         	}

                         	this.app.debug("wptName: " + wptName)

				// Create a text encorder
                                let utf8Encoder = new TextEncoder()

                                // Get the waypoint name chars as an array
                                let chars = utf8Encoder.encode(wptName)

                                // Offset the charts by 0x30
                                for (let i = 0; i < 4; i++) chars[i] = chars[i]-0x30

				// Encode the waypoint name
                                let XX =  (chars[0] & 0x3f) | ((chars[1]<<6) & 0xc0)
                                let YY = ((chars[1]>>2) & 0x0f) | ((chars[2]<<4) & 0xf0)
                                let ZZ = ((chars[2]>>4) & 0x03) | ((chars[3]<<2) & 0xfc)

				// Prepare the result
				result = {
                                	XX: XX,
					YY: YY,
                                	ZZ: ZZ,

                                        // Compute the complement
                                        xx: 0xff-XX,
                                        yy: 0xff-YY,
                                        zz: 0xff-ZZ
				}

			}

		}

		return result
	}
}

module.exports = {
	Waypoint: Waypoint
}
