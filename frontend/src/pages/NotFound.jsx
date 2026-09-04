import { Home } from "lucide-react";
import { Link } from "react-router-dom";
import { Button } from "../components/common/Button";
import { Card } from "../components/common/Card";

export function NotFound() {
  return <Card className="mx-auto max-w-lg p-8 text-center"><p className="text-sm font-semibold text-brand-700">404</p><h1 className="mt-2 text-2xl font-bold text-slate-950">Page not found</h1><p className="mt-2 text-sm leading-6 text-slate-600">The page you requested does not exist or has moved.</p><Button as={Link} to="/dashboard" className="mt-5"><Home size={17} aria-hidden="true" />Go to dashboard</Button></Card>;
}
