import { readFile, writeFile } from 'node:fs/promises';

const source = new URL('../vendor/NewShoes-main/WebAssembly/harness/launcher-desktop-apps.js', import.meta.url);
let text = await readFile(source, 'utf8');
const needle = '          fileRow.append(name, size);';
if (text.split(needle).length !== 2) throw new Error('The upstream storage row changed; inspect it before applying the backup control.');
text = 'import { downloadInstalledArchive, prepareInstalledBackup } from "./launcher-archive-download.mjs";\n' + text;
const listAnchor = '        details.append(row, files);';
if (text.split(listAnchor).length !== 2) throw new Error('The upstream storage panel changed.');
text = text.replace(listAnchor, `        const installedSet = window.ZeroHAssetLibrary.installedLibrary();
        if (installedSet?.root === entry.path) {
          const backupBar = document.createElement("div");
          backupBar.className = "managed-storage-backup";
          const backup = document.createElement("button");
          backup.type = "button";
          backup.className = "toolbar-button primary-lite";
          backup.textContent = "Download all (ZIP)";
          const status = document.createElement("span");
          status.setAttribute("role", "status");
          status.textContent = \`One ZIP · \${installedSet.archives.length} game archives · extract before importing again\`;
          const cancel = document.createElement("button");
          cancel.type = "button";
          cancel.className = "toolbar-button";
          cancel.textContent = "Cancel";
          cancel.hidden = true;
          let controller;
          cancel.addEventListener("click", () => controller?.abort());
          backup.addEventListener("click", async () => {
            if (desktop.preparingLibrary || desktop.backupInProgress) {
              desktop.showToast("Please wait", "Finish the current installation or backup first.", "warning");
              return;
            }
            controller = new AbortController();
            desktop.backupInProgress = true;
            backup.disabled = true;
            remove.disabled = true;
            cancel.hidden = false;
            status.textContent = "Preparing ZIP locally…";
            try {
              const result = await prepareInstalledBackup({
                signal: controller.signal,
                onProgress: ({ name, completed, total }) => {
                  status.textContent = \`Preparing \${Math.floor(completed / total * 100)}% · \${name}\`;
                },
              });
              const save = document.createElement("a");
              save.className = "toolbar-button primary-lite backup-save";
              save.href = URL.createObjectURL(result.blob);
              save.download = "Zero-Hour-backup.zip";
              save.textContent = \`Save ZIP (\${formatBytes(result.blob.size)})\`;
              save.addEventListener("click", () => {
                status.textContent = "Download requested — check your browser’s Downloads, then extract the ZIP.";
              });
              backup.replaceWith(save);
              status.textContent = \`Ready · \${result.count} game archives · click Save ZIP\`;
            } catch (error) {
              status.textContent = error?.name === "AbortError" ? "Backup cancelled. Your installed files are unchanged." : "Could not prepare ZIP. Try again or download individual archives.";
              if (error?.name !== "AbortError") desktop.showToast("Backup failed", error?.message || String(error), "warning");
              backup.disabled = false;
            } finally {
              desktop.backupInProgress = false;
              remove.disabled = !entry.deletable;
              cancel.hidden = true;
            }
          });
          backupBar.append(backup, cancel, status);
          files.prepend(backupBar);
        }
${listAnchor}`);
text = text.replace('if (desktop.preparingLibrary) {', 'if (desktop.preparingLibrary || desktop.backupInProgress) {');
text = text.replace('Wait until Project New Shoes finishes copying the game files before changing browser storage.', 'Wait until the installation or backup finishes before changing browser storage.');
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
