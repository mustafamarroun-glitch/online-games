import { readFile, writeFile } from 'node:fs/promises';

const source = new URL('../vendor/NewShoes-main/WebAssembly/harness/launcher-desktop-apps.js', import.meta.url);
let text = await readFile(source, 'utf8');
const needle = '          fileRow.append(name, size);';
if (text.split(needle).length !== 2) throw new Error('The upstream storage row changed; inspect it before applying the backup control.');
text = 'import { downloadInstalledArchive } from "./launcher-archive-download.mjs";\n' + text;
text = text.replace(needle, `${needle}
          const installed = window.ZeroHAssetLibrary.installedLibrary();
          if (installed?.root === entry.path && installed.archives.some(archive => archive.name === file.path)) {
            fileRow.classList.add("managed-storage-file-download");
            const download = document.createElement("button");
            download.type = "button";
            download.className = "toolbar-button";
            download.textContent = "Download";
            download.setAttribute("aria-label", \`Download \${file.path}\`);
            download.addEventListener("click", async () => {
              if (desktop.preparingLibrary) {
                desktop.showToast("Installation in progress", "Wait until your game files finish installing before downloading a backup.", "warning");
                return;
              }
              download.disabled = true;
              try {
                await downloadInstalledArchive(file.path);
                desktop.showToast("Download requested", \`\${file.path} — check your browser's Downloads. Keep all game archives together for a future folder import.\`);
              } catch (error) {
                desktop.showToast("Archive download failed", error?.message || String(error), "warning");
              } finally { download.disabled = false; }
            });
            fileRow.append(download);
          }`);
await writeFile(new URL('../overrides/harness/launcher-desktop-apps.js', import.meta.url), text);
console.log('Generated installed-archive download controls without changing upstream source.');
