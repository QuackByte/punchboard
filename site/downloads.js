const REPO = "QuackByte/punchboard";
const FALLBACK_URL = `https://github.com/${REPO}/releases/latest`;

async function loadReleaseLinks() {
  const links = {
    mac: document.querySelector("[data-download='mac']"),
    win: document.querySelector("[data-download='win']"),
    linux: document.querySelector("[data-download='linux']"),
  };
  const versionEls = document.querySelectorAll("[data-version]");

  try {
    const response = await fetch(`https://api.github.com/repos/${REPO}/releases/latest`);
    if (!response.ok) throw new Error(`GitHub API responded ${response.status}`);
    const release = await response.json();
    const assets = release.assets || [];

    const findAsset = (suffix) =>
      assets.find((asset) => asset.name.toLowerCase().endsWith(suffix));

    const matches = {
      mac: findAsset(".dmg"),
      win: findAsset(".exe"),
      linux: findAsset(".appimage"),
    };

    for (const platform of Object.keys(links)) {
      const asset = matches[platform];
      if (asset && links[platform]) {
        links[platform].href = asset.browser_download_url;
      }
    }

    if (release.tag_name) {
      versionEls.forEach((el) => {
        el.textContent = release.tag_name.replace(/^punchboard-v/, "v");
      });
    }
  } catch {
    Object.values(links).forEach((el) => {
      if (el) el.href = FALLBACK_URL;
    });
  }
}

function highlightVisitorPlatform() {
  const platform = `${navigator.platform || ""} ${navigator.userAgent || ""}`;
  let key = null;
  if (/Mac/i.test(platform)) key = "mac";
  else if (/Win/i.test(platform)) key = "win";
  else if (/Linux/i.test(platform)) key = "linux";

  if (!key) return;
  const card = document.querySelector(`[data-platform-card="${key}"]`);
  if (card) card.classList.add("is-highlighted");
}

loadReleaseLinks();
highlightVisitorPlatform();
