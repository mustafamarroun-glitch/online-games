import { DEVICE_TRANSFER_VERSION } from './device-transfer-protocol.mjs';

export const MAX_TRANSFER_FILES = 512;
export const MAX_TRANSFER_BYTES = 64 * 1024 ** 3;
const KINDS = new Set(['archive', 'video', 'cursor', 'mod-archive', 'save', 'replay']);

export function validateCombinedManifest(value) {
  if (value?.version !== DEVICE_TRANSFER_VERSION || value?.game !== 'zeroHour'
      || !Array.isArray(value.files) || !value.files.length || value.files.length > MAX_TRANSFER_FILES) {
    throw new Error('The sender returned an invalid Zero Hour manifest');
  }
  const files = value.files.map(file => {
    if (typeof file?.id !== 'string' || !/^[A-Za-z0-9_-]{1,128}$/.test(file.id)
        || !KINDS.has(file.kind) || typeof file.name !== 'string' || !file.name.trim()
        || file.name.length > 255 || /[\\/\x00-\x1f\x7f]/.test(file.name)
        || ['.', '..'].includes(file.name) || !Number.isSafeInteger(file.bytes)
        || file.bytes <= 0 || file.bytes > MAX_TRANSFER_BYTES) {
      throw new Error('The sender returned an invalid file list');
    }
    if (['archive', 'cursor'].includes(file.kind)
        && (!Number.isSafeInteger(file.entryCount) || file.entryCount <= 0)) {
      throw new Error('The sender returned an invalid archive entry count');
    }
    return { id: file.id, kind: file.kind, name: file.name, bytes: file.bytes,
      ...(['archive', 'cursor'].includes(file.kind) ? { entryCount: file.entryCount } : {}) };
  });
  const sharedNames = files.filter(file => file.kind !== 'mod-archive');
  if (new Set(files.map(file => file.id)).size !== files.length
      || new Set(sharedNames.map(file => `${file.kind}:${file.name.toLowerCase()}`)).size !== sharedNames.length) {
    throw new Error('The sender returned duplicate files');
  }
  const mods = value.mods ?? null;
  if (Boolean(files.some(file => file.kind === 'mod-archive')) !== Boolean(mods)) {
    throw new Error('The sender returned incomplete mod transfer metadata');
  }
  const totalBytes = files.reduce((sum, file) => sum + file.bytes, 0);
  if (!Number.isSafeInteger(totalBytes) || totalBytes > MAX_TRANSFER_BYTES) {
    throw new Error('The transfer exceeds the 64 GB size limit');
  }
  const modContextId = value.modContextId ?? 'vanilla';
  if (typeof modContextId !== 'string' || !/^(?:vanilla|[a-f0-9]{64})$/.test(modContextId)) {
    throw new Error('The sender returned an invalid mod configuration identity');
  }
  return { version: DEVICE_TRANSFER_VERSION, game: 'zeroHour', modContextId, files, mods, totalBytes };
}

export function validateTransferMessage(message, payload) {
  const types = ['hello', 'manifest', 'ready', 'file-start', 'chunk', 'ack', 'file-end', 'complete', 'complete-ack'];
  if (!types.includes(message?.type)) throw new Error('Unknown transfer message');
  if (message.type === 'hello') {
    if (!['sender', 'receiver'].includes(message.role)) throw new Error('Invalid transfer role');
  } else if (typeof message.transferId !== 'string'
      || !/^[a-f0-9-]{36}$/i.test(message.transferId)) throw new Error('Invalid transfer identity');
  if (['file-start', 'chunk', 'file-end'].includes(message.type)
      && (typeof message.fileId !== 'string' || !/^[A-Za-z0-9_-]{1,128}$/.test(message.fileId))) {
    throw new Error('Invalid transfer file identity');
  }
  if (message.type === 'chunk') {
    if (!payload.byteLength || !Number.isSafeInteger(message.offset) || message.offset < 0
        || typeof message.checkpoint !== 'boolean' || !Number.isSafeInteger(message.seq)
        || message.seq < 0 || (message.checkpoint && message.seq === 0)) {
      throw new Error('Incoming file chunk is invalid');
    }
  } else if (payload.byteLength) throw new Error('Unexpected transfer payload');
  if (['ack', 'file-end'].includes(message.type)
      && (!Number.isSafeInteger(message.seq) || message.seq <= 0)) throw new Error('Invalid transfer acknowledgement');
}
