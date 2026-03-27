import AdminApp from "./AdminApp.jsx";
import { BananaStudioApp, RouteRedirect } from "./BananaStudioApp.jsx";
import {
  LOGIN_PATH,
  STUDIO_PATH,
  normalizeTextValue,
  readSearchParam,
} from "./bananaStudioShared.jsx";

function App() {
  const pathname =
    typeof window !== "undefined" && typeof window.location?.pathname === "string"
      ? window.location.pathname
      : "/";
  const isE2eStudioRoute =
    import.meta.env.DEV &&
    normalizeTextValue(readSearchParam("e2e")) === "1";

  if (pathname === "/admin" || pathname.startsWith("/admin/")) {
    return <AdminApp />;
  }

  if (pathname === "/" || pathname === "") {
    return <RouteRedirect to={LOGIN_PATH} />;
  }

  if (pathname === LOGIN_PATH || pathname.startsWith(`${LOGIN_PATH}/`)) {
    return <BananaStudioApp routeMode={isE2eStudioRoute ? "studio" : "login"} />;
  }

  if (pathname === STUDIO_PATH || pathname.startsWith(`${STUDIO_PATH}/`)) {
    return <BananaStudioApp routeMode="studio" />;
  }

  return <RouteRedirect to={LOGIN_PATH} />;
}

export default App;
