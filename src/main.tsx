import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";
import { initAnalyticsListener } from "./utils/analyticsClient";

// Inicializar listener de analytics
initAnalyticsListener();

createRoot(document.getElementById("root")!).render(<App />);
