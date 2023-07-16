/*
  Code for SeaTalk(tm) over NMEA0183 encoding and decoding
 */

// The hex digits
const m_hex = [ '0', '1', '2', '3',
  '4', '5', '6', '7',
  '8', '9', 'A', 'B',
  'C', 'D', 'E', 'F'
]

// Create the STALK datagram given the data parts
function toDatagram (parts) {
  // Set the base datagram
  let base = "$STALK,"+parts.join(',')

  // Return the base and the NMEA0183 checksum
  return base + computeChecksum(base)
}

// Compute the NMEA0183 checksum
function computeChecksum (datagram) {

  // Skip the $
  let i = 1

  // Initialize to first character
  let c1 = datagram.charCodeAt(i)

  // Process rest of characters, zero delimited
  for (i = 2; i < datagram.length; ++i) {
    c1 = c1 ^ datagram.charCodeAt(i)
  }

  // Return the checksum prepended by an asterisk
  return '*' + toHexString(c1)
}

// Return a hex string representing an integer value
function toHexString (v) {
  let msn = (v >> 4) & 0x0f
  let lsn = (v >> 0) & 0x0f
  return m_hex[msn] + m_hex[lsn]
}

// Perform the string padding
function padd (n, p, c) {
  let pad_char = typeof c !== 'undefined' ? c : '0'
  let pad = new Array(1 + p).join(pad_char)
  return (pad + n).slice(-pad.length)
}

// Floor module
function fmod(a,b) {
  return Number((a-(Math.floor(a/b)*b)).toPrecision(8))
}

// Set the module content
module.exports = {
  toDatagram: toDatagram,
  toHexString: toHexString,
  padd: padd,
  fmod: fmod
}
