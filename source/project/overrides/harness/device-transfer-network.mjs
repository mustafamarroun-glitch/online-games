// Relay credentials are kept only in this tab. A deployment may instead supply
// short-lived credentials via credentialEndpoint; never put a provider admin key here.
const SESSION_KEY = 'winchester-transfer-network.v1';
export const DEFAULT_STUN_SERVERS = [
  { urls: 'stun:stun.l.google.com:19302' },
  { urls: 'stun:stun.cloudflare.com:3478' },
];

export function validateIceServers(value) {
  if (!Array.isArray(value) || value.length > 16) throw new Error('Enter a valid relay configuration.');
  return value.map(server => {
    const urls = typeof server?.urls === 'string' ? [server.urls] : server?.urls;
    if (!Array.isArray(urls) || !urls.length || urls.length > 8 || urls.some(url =>
      typeof url !== 'string' || url.length > 512 || !/^(stun|stuns|turn|turns):[^\s/@]+(?:\?transport=(udp|tcp))?$/.test(url))) {
      throw new Error('Relay addresses must begin with turn: or turns:.');
    }
    const hasTurn = urls.some(url => /^turns?:/.test(url));
    if (hasTurn && (typeof server.username !== 'string' || !server.username.trim() ||
      typeof server.credential !== 'string' || !server.credential)) {
      throw new Error('A TURN relay needs its username and password.');
    }
    if ([server.username, server.credential].some(v => v != null && (typeof v !== 'string' || v.length > 1024))) {
      throw new Error('Relay credentials are invalid.');
    }
    return { urls: [...urls], ...(hasTurn ? { username: server.username, credential: server.credential } : {}) };
  });
}

export function hasTurnServers(servers) {
  return servers.some(server => (Array.isArray(server.urls) ? server.urls : [server.urls]).some(url => /^turns?:/.test(url)));
}

export function readTabRelay() {
  try { return validateIceServers(JSON.parse(sessionStorage.getItem(SESSION_KEY) || '[]')); }
  catch { return []; }
}

export function saveTabRelay(servers) {
  const validated = validateIceServers(servers);
  if (validated.length) sessionStorage.setItem(SESSION_KEY, JSON.stringify(validated));
  else sessionStorage.removeItem(SESSION_KEY);
}

async function readNetworkJson(response) {
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let bytes = 0;
  let text = '';
  try {
    while (true) {
      const chunk = await reader.read();
      if (chunk.done) break;
      bytes += chunk.value.byteLength;
      if (bytes > 32 * 1024) throw new Error('The relay configuration is too large.');
      text += decoder.decode(chunk.value, { stream: true });
    }
    return JSON.parse(text + decoder.decode());
  } finally { await reader.cancel().catch(() => {}); reader.releaseLock(); }
}

export async function loadTransferNetwork({ signal } = {}) {
  const controller = new AbortController();
  const abort = () => controller.abort(signal.reason);
  if (signal?.aborted) abort();
  else signal?.addEventListener('abort', abort, { once: true });
  const timer = setTimeout(() => controller.abort(), 15000);
  try { return await readTransferNetwork(controller.signal); }
  finally { clearTimeout(timer); signal?.removeEventListener('abort', abort); }
}

async function readTransferNetwork(signal) {
  let servers = readTabRelay();
  if (!servers.length) {
    const response = await fetch(new URL('./device-transfer-network.json', import.meta.url), { cache: 'no-store', signal });
    if (!response.ok) throw new Error('Could not load connection settings. Please retry.');
    const config = await readNetworkJson(response);
    servers = validateIceServers(config.iceServers ?? []);
    if (config.credentialEndpoint) {
      const endpoint = new URL(config.credentialEndpoint, location.href);
      if (endpoint.protocol !== 'https:' || endpoint.username || endpoint.password) {
        throw new Error('The relay credential endpoint must use HTTPS.');
      }
      const credentials = await fetch(endpoint, { cache: 'no-store', credentials: 'omit', redirect: 'error', signal });
      if (!credentials.ok) throw new Error('The internet relay is unavailable. Check its configuration or use the same Wi-Fi.');
      servers = validateIceServers(await readNetworkJson(credentials));
      if (!hasTurnServers(servers)) throw new Error('The relay service did not return a TURN server.');
    }
  }
  return { iceServers: [...DEFAULT_STUN_SERVERS, ...servers], relayConfigured: hasTurnServers(servers) };
}

// Check a real TURN allocation, rather than treating a saved address as working.
export async function testTransferRelay(servers, { timeoutMs = 12000 } = {}) {
  const iceServers = validateIceServers(servers);
  if (!hasTurnServers(iceServers)) throw new Error('Add a TURN relay before testing.');
  const connection = new RTCPeerConnection({ iceServers, iceTransportPolicy: 'relay' });
  let timer;
  try {
    const allocation = new Promise((resolve, reject) => {
      timer = setTimeout(() => reject(new Error('Relay did not respond. Check its address, credentials, and network access.')), timeoutMs);
      connection.onicecandidate = event => {
        if (event.candidate?.type === 'relay') resolve();
        else if (!event.candidate) reject(new Error('Relay connection failed. Check its address and credentials.'));
      };
    });
    allocation.catch(() => {});
    connection.createDataChannel('relay-check');
    await connection.setLocalDescription(await connection.createOffer());
    await allocation;
  } finally { clearTimeout(timer); connection.close(); }
}

export function connectionHelp(relayConfigured) {
  return relayConfigured
    ? 'The encrypted connection could not open. Test the relay in Connection settings, then retry. Keep both pages open and check the transfer code.'
    : 'The direct connection could not open. Try the same Wi-Fi with VPNs off, or add an internet relay in Connection settings to transfer across restricted networks.';
}
