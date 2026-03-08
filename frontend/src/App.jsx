import { Routes, Route } from "react-router-dom";
import LandingPage from "./pages/LandingPage";
import TechnicalPage from "./pages/TechnicalPage";
import MediScribeApp from "./MediScribeApp";

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<LandingPage />} />
      <Route path="/technical" element={<TechnicalPage />} />
      <Route path="/app" element={<MediScribeApp />} />
    </Routes>
  );
}
