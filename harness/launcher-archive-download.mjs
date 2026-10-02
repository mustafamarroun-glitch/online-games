// Export only validated archives from this browser's installed library.
// Ordinary downloads also work when showDirectoryPicker is unavailable.
export async function downloadInstalledArchive(name) {
  const installed = window.ZeroHAssetLibrary.installedLibrary();
  const archive = installed?.archives.find(item => item.name === name);
  if (!archive) throw new Error('This archive is no longer installed. Refresh Browser Storage and try again.');
  const parts = archive.opfsPath.split('/');
  let directory = await navigator.storage.getDirectory();
  for (const part of parts.slice(0, -1)) {
    directory = await directory.getDirectoryHandle(part, { create: false });
  }
  const file = await (await directory.getFileHandle(parts.at(-1), { create: false })).getFile();
  if (file.size !== archive.bytes) throw new Error(`${name} has changed. Import your original game folder again.`);
  // File-backed URLs let the browser stream to disk without making a full
  // archive-sized JavaScript buffer or changing the stored game files.
  const url = URL.createObjectURL(file);
  const link = document.createElement('a');
  link.href = url;
  link.download = archive.name;
  link.hidden = true;
  document.body.append(link);
  try { link.click(); } finally {
    link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 120000);
  }
}
