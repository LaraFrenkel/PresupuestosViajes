import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App.jsx";
import "./styles.css";

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);

if ("serviceWorker" in navigator) {
  let recargandoPorActualizacion = false;
  navigator.serviceWorker.addEventListener("controllerchange", () => {
    if (recargandoPorActualizacion) return;
    recargandoPorActualizacion = true;
    window.location.reload();
  });

  window.addEventListener("load", () => {
    navigator.serviceWorker
      .register("/sw.js", { updateViaCache: "none" })
      .then((registro) => registro.update())
      .catch((error) => {
        console.warn("No se pudo registrar el modo instalable.", error);
      });
  });
}
