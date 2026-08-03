# Punchboard

A desktop app for tracking daily work hours, estimating pay, and keeping an
eye on your yearly workload — for macOS, Windows, and Linux.

Your data stays in a plain JSON file that you choose the location of, so it's
easy to sync with iCloud, Dropbox, or any folder you already back up.

**[quackbyte.dev/punchboard](https://quackbyte.dev/punchboard/)** —
marketing page, or jump straight into the
[browser app](https://quackbyte.dev/punchboard/app/).

## Features

- **Calendar-based tracking** — click through a monthly grid to log hours per
  day, either as a duration (`7.5`) or a time range (`9:00-17:30`).
- **Day exceptions** — mark days as vacation, sick leave, or holiday, with
  automatic exclusion from expected working hours.
- **Extra hours** — track overtime separately from the regular schedule.
- **Salary estimation** — set an hourly rate, tax percentage, and extra
  deductions to see estimated gross and net pay for the current payslip
  period (with a configurable payslip start day).
- **Currency conversion** — optionally show a second currency alongside your
  primary one, using a manual conversion rate.
- **Yearly overview** — a chart of hours worked per month across the year.
- **Weekly totals** — see hours summed per week alongside the monthly view.
- **Import/export** — back up or move your data as a JSON file.
- **Light/dark theme**.
- **Auto-updates** on macOS, Windows, and Linux via `electron-updater`.

## Install

**macOS (Apple Silicon)** — via Homebrew:

```bash
brew install --cask quackbyte/tap/punchboard
```

Or download the latest release for your platform from the
[Releases page](https://github.com/QuackByte/punchboard/releases):

- **macOS** — `.dmg` or `.zip` (signed and notarized)
- **Windows** — `.exe` (NSIS installer)
- **Linux** — `.AppImage`

Installed apps check GitHub Releases for updates automatically (every 6
hours) and prompt to restart once a new version has downloaded — no manual
reinstalling needed.

## Development

Requires Node.js 22+.

```bash
npm install

# Run the renderer only, in a browser (fastest for UI work)
npm run dev

# Run the full Electron app in dev mode, with hot reload
npm run electron:dev
```

### Building

```bash
# Build the web + electron bundles
npm run build

# Package a distributable for your current platform
npm run dist
```

### Project structure

- `src/` — React renderer (UI, state, business logic)
- `electron/` — Electron main process and preload scripts
- `build-resources/` — packaging assets (entitlements, afterPack hook)
- `site/` — static marketing page deployed to GitHub Pages, with the web
  build of `src/` nested at `/app`

### Stack

React, TypeScript, Vite, Tailwind CSS, Radix UI primitives (via
[shadcn/ui](https://ui.shadcn.com/)-style components), and Electron.

## Releases

Releases are automated with
[release-please](https://github.com/googleapis/release-please): merging to
`main` with conventional commits opens a release PR, and merging that PR
tags a release and triggers signed builds for all three platforms.

## License

[MIT](LICENSE)
