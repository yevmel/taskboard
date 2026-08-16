import "./style.css";
import { getState, initStore } from "./store.ts";
import { app } from "./components/app.ts";
import { closeDrawer, loadTasks } from "./actions.ts";
import { applyTheme, getInitialTheme } from "./theme.ts";
import { connectWs } from "./ws.ts";

const root = document.getElementById("app");
if (root === null) throw new Error("Missing #app element");

// Resolve and apply the theme before the first render (no flash), and seed the
// state with it so the switch shows the correct icon right away.
const initialTheme = getInitialTheme();
applyTheme(initialTheme);

initStore(root, app, { theme: initialTheme });
void loadTasks();

// Real-time updates from other clients.
connectWs();

// Close the drawer with the Escape key.
document.addEventListener("keydown", (event: KeyboardEvent) => {
  if (event.key === "Escape" && getState().selectedTaskId !== null) {
    closeDrawer();
  }
});
