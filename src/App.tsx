import { lazy, Suspense, useEffect } from "react";
import { BrowserRouter, Route, Routes, useLocation } from "react-router";
import { DemoProvider } from "./app/DemoProvider";
import { AuthProvider } from "./app/AuthProvider";
import { AppLayout } from "./components/AppLayout";
import { LoadingState } from "./components/ui";
import "./App.css";

const LandingPage = lazy(() => import("./pages/LandingPage"));
const SessionPage = lazy(() => import("./pages/SessionPage"));
const SessionEntryPage = lazy(() =>
  import("./pages/SessionPage").then((module) => ({
    default: module.SessionEntryPage,
  })),
);
const NotFoundPage = lazy(() =>
  import("./pages/SessionPage").then((module) => ({
    default: module.NotFoundPage,
  })),
);
const QuestionnairePage = lazy(() => import("./pages/QuestionnairePage"));
const DifferencesPage = lazy(() => import("./pages/DifferencesPage"));
const SimulatorPage = lazy(() => import("./pages/SimulatorPage"));
const AgreementPage = lazy(() => import("./pages/AgreementPage"));
const AgreementDocumentPage = lazy(
  () => import("./pages/AgreementDocumentPage"),
);

function RouteAccessibility() {
  const { pathname, hash } = useLocation();
  useEffect(() => {
    const name = pathname.includes("questionnaire")
      ? "Your perspective"
      : pathname.includes("differences")
        ? "Our perspectives"
        : pathname.includes("simulator")
          ? "Explore the numbers"
          : pathname.includes("agreement")
            ? "Our money agreement"
            : pathname === "/"
              ? "Plan it together"
              : "Your shared starting point";
    document.title = `${name} | FirstSharedMoney`;
    const frame = requestAnimationFrame(() => {
      if (hash && pathname !== "/join")
        document.getElementById(hash.slice(1))?.scrollIntoView();
      else {
        window.scrollTo(0, 0);
        document.getElementById("main-content")?.focus({ preventScroll: true });
      }
    });
    return () => cancelAnimationFrame(frame);
  }, [pathname, hash]);
  return null;
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <DemoProvider>
          <a href="#main-content" className="skip-link">
            Skip to main content
          </a>
          <RouteAccessibility />
          <Suspense fallback={<LoadingState />}>
            <Routes>
              <Route path="/" element={<LandingPage />} />
              <Route path="/create" element={<SessionEntryPage />} />
              <Route path="/join" element={<SessionEntryPage />} />
              <Route path="/sessions/:coupleId" element={<AppLayout />}>
                <Route index element={<SessionPage />} />
                <Route path="questionnaire/*" element={<QuestionnairePage />} />
                <Route path="differences" element={<DifferencesPage />} />
                <Route path="simulator" element={<SimulatorPage />} />
                <Route path="agreement" element={<AgreementPage />} />
                <Route
                  path="agreement/preview"
                  element={<AgreementDocumentPage />}
                />
              </Route>
              <Route path="*" element={<NotFoundPage />} />
            </Routes>
          </Suspense>
        </DemoProvider>
      </AuthProvider>
    </BrowserRouter>
  );
}
