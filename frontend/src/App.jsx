import { Navigate, Route, Routes } from "react-router-dom";
import { AppLayout } from "./components/layout/AppLayout";
import { CallDetails } from "./pages/CallDetails";
import { CallHistory } from "./pages/CallHistory";
import { Dashboard } from "./pages/Dashboard";
import { KnowledgeBase } from "./pages/KnowledgeBase";
import { NewCall } from "./pages/NewCall";
import { NotFound } from "./pages/NotFound";

export default function App() {
  return (
    <Routes>
      <Route element={<AppLayout />}>
        <Route index element={<Navigate to="/dashboard" replace />} />
        <Route path="dashboard" element={<Dashboard />} />
        <Route path="calls/new" element={<NewCall />} />
        <Route path="calls" element={<CallHistory />} />
        <Route path="calls/:id" element={<CallDetails />} />
        <Route path="knowledge-base" element={<KnowledgeBase />} />
        <Route path="*" element={<NotFound />} />
      </Route>
    </Routes>
  );
}
