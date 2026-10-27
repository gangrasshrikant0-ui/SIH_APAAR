import React, { useState } from "react";
import { ArrowLeft, ArrowRight, Building2, ShieldCheck, UserCheck, GraduationCap } from "lucide-react";
import { Link, useNavigate, useParams, useSearchParams } from "react-router-dom";
import { authApi } from "../api/authApi";
import { listDemoLoginHints } from "../mocks/demoReference.js";

const roleConfig = {
  aicte: { role: "AICTE", label: "AICTE Administrator", icon: ShieldCheck, destination: "/aicte/workbench" },
  college: { role: "COLLEGE", label: "College / Institution", icon: Building2, destination: "/college/upload" },
  student: { role: "STUDENT", label: "Student", icon: GraduationCap, destination: "/student/portal" }
};

export function LoginPage() {
  const { role: roleParam } = useParams();
  const config = roleConfig[roleParam];
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const hints = listDemoLoginHints().filter((item) => item.role === config?.role);
  const defaultHint = hints[0];
  const [identifier, setIdentifier] = useState(defaultHint?.identifier || "");
  const [password, setPassword] = useState(defaultHint?.password || "");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  if (!config) {
    return <Link to="/roles">Choose a role</Link>;
  }

  const Icon = config.icon;
  const handleSubmit = async (event) => {
    event.preventDefault();
    setLoading(true);
    setError("");
    try {
      await authApi.login({ role: config.role, identifier, password });
      navigate(searchParams.get("returnTo") || config.destination);
    } catch (loginError) {
      setError(loginError.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="login-page">
      <div className="login-card gov-card" style={{ width: "min(100%, 560px)" }}>
        <Link to="/roles" className="back-link"><ArrowLeft size={16} /> Back to roles</Link>
        <div className="role-card-icon"><Icon size={24} /></div>
        <h1>{config.label}</h1>
        <p className="login-subtitle">Sign in with your account. Select a listed account to fill the credentials.</p>
        {error && <div className="login-error" role="alert">{error}</div>}
        <form onSubmit={handleSubmit} className="login-form">
          <label htmlFor="identifier">Email or username</label>
          <input id="identifier" value={identifier} onChange={(event) => setIdentifier(event.target.value)} autoComplete="username" />
          <label htmlFor="password">Password</label>
          <input id="password" type="password" value={password} onChange={(event) => setPassword(event.target.value)} autoComplete="current-password" />
          <button type="submit" className="btn btn-primary" disabled={loading}>
            {loading ? "Signing in..." : "Sign in"}
            {!loading && <ArrowRight size={16} />}
          </button>
        </form>
        <div className="demo-credentials">
          <strong>Available sign-in accounts</strong>
          <p>Select an account below to fill in its sign-in details.</p>
          <ul>
            {hints.map((hint) => (
              <li key={hint.username}>
                <button
                  type="button"
                  className="demo-credential-fill"
                  onClick={() => {
                    setIdentifier(hint.identifier);
                    setPassword(hint.password);
                    setError("");
                  }}
                >
                  <span>{hint.label}</span>
                  <code>{hint.identifier}</code>
                  <code>{hint.password}</code>
                </button>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </main>
  );
}
