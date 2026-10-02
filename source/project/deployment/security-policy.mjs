// Same-origin scripts only. Inline styles support the existing desktop and games.
// Connections remain configurable for user-selected AI endpoints and WebRTC discovery.
export const SECURITY_POLICY = "script-src 'self' 'wasm-unsafe-eval'; object-src 'none'; base-uri 'self'; form-action 'self'";
export const SECURITY_META = `<meta http-equiv="Content-Security-Policy" content="${SECURITY_POLICY}">\n    <meta name="referrer" content="no-referrer">`;
