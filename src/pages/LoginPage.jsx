import React, { useState } from "react";
import { ArrowLeft, ArrowRight, Building2, ShieldCheck, UserCheck } from "lucide-react";
import { Link, useNavigate, useParams, useSearchParams } from "react-router-dom";
import { authApi } from "../api/authApi";
import { DEMO_ACCOUNTS } from "../mocks/mockStore";

const roleConfig = {
  aicte: { role: "AICTE", label: "AICTE Administrator", icon: ShieldCheck, destination: "/aicte/workbench" },
  college: { role: "COLLEGE", label: "College / Institution", icon: Building2, destination: "/college/dashboard" },
  external: { role: "EXTERNAL_VERIFIER", label: "External Verifier", icon: UserCheck, destination: "/external/verify" }
};

export function LoginPage() {
  const { role: roleParam } = useParams();
  const config = roleConfig[roleParam];
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const account = config ? DEMO_ACCOUNTS[config.role] : null;
  const [identifier, setIdentifier] = useState(account?.email || "");
  const [password, setPassword] = useState(account?.passwordHint || "");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  if (!config || !account) {
    return <NavigateToRoles />;
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
      <div className="login-card gov-card">
        <Link to="/roles" className="back-link"><ArrowLeft size={16} /> Back to roles</Link>
        <div className="role-card-icon"><Icon size={24} /></div>
        <h1>{config.label}</h1>
        <p className="login-subtitle">Sign in to continue to the demonstration portal.</p>
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
        <p className="demo-hint">Demo account is pre-filled for this prototype.</p>
      </div>
    </main>
  );
}

function NavigateToRoles() {
  return <Link to="/roles">Choose a role</Link>;
}
