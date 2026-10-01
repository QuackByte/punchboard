import TrayPanel from "./components/TrayPanel";
import WorkTracker from "./components/WorkTracker";

// The desktop app loads the same bundle into its tray popover with #tray.
const isTrayPanel = window.location.hash === "#tray";

if (isTrayPanel) {
  document.documentElement.classList.add("tray-panel");
}

export default function App() {
  return isTrayPanel ? <TrayPanel /> : <WorkTracker />;
}
