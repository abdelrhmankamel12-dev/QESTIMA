(function (root) {
  "use strict"
  const hex = (bytes) => Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("")
  const fromHex = (text) => Uint8Array.from(text.match(/../g) || [], (byte) => parseInt(byte, 16))
  async function hash(password, saltHex) {
    const salt = saltHex ? fromHex(saltHex) : crypto.getRandomValues(new Uint8Array(16))
    const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(password), "PBKDF2", false, ["deriveBits"])
    const bits = await crypto.subtle.deriveBits({ name: "PBKDF2", salt, iterations: 310000, hash: "SHA-256" }, key, 256)
    return `pbkdf2-sha256$310000$${hex(salt)}$${hex(new Uint8Array(bits))}`
  }
  async function verify(password, stored) {
    if (!/^pbkdf2-sha256\$310000\$[0-9a-f]{32}\$[0-9a-f]{64}$/.test(stored || "")) return false
    const calculated = await hash(password, stored.split("$")[2])
    let difference = 0
    for (let i = 0; i < calculated.length; i++) difference |= calculated.charCodeAt(i) ^ stored.charCodeAt(i)
    return difference === 0
  }
  root.QESTIMAAuth = { hash, verify }
})(typeof window !== "undefined" ? window : globalThis)
