"use client";

import { useState } from "react";
import type { SocialProvider } from "@/lib/auth";
import { authClient } from "@/lib/auth-client";
import styles from "./LoginForm.module.css";

const PROVIDER_LABEL: Record<SocialProvider, string> = { github: "GitHub", google: "Google" };

type Mode = "signin" | "signup";

/** Sign in / sign up as a "double slider": a brass overlay slides across to swap the two forms. */
export function LoginForm({ next, providers }: { next: string; providers: SocialProvider[] }) {
  const [mode, setMode] = useState<Mode>("signin");
  const signingUp = mode === "signup";

  return (
    <div className="flex min-h-[calc(100vh-11rem)] items-center py-4">
      <div className={`${styles.container} ${signingUp ? styles.active : ""}`}>
        <div className={`${styles.formContainer} ${styles.signUp}`} inert={!signingUp}>
          <AuthForm mode="signup" next={next} providers={providers} onSwitch={() => setMode("signin")} />
        </div>
        <div className={`${styles.formContainer} ${styles.signIn}`} inert={signingUp}>
          <AuthForm mode="signin" next={next} providers={providers} onSwitch={() => setMode("signup")} />
        </div>

        <div className={styles.overlayContainer} aria-hidden="true">
          <div className={styles.overlay}>
            <div className={`${styles.overlayPanel} ${styles.overlayLeft}`} inert={!signingUp}>
              <h2 className={styles.title}>Welcome back</h2>
              <p>Already tracking? Sign in to pick up your revision queue where you left it.</p>
              <button type="button" className={styles.ghost} onClick={() => setMode("signin")}>
                Sign in
              </button>
            </div>
            <div className={`${styles.overlayPanel} ${styles.overlayRight}`} inert={signingUp}>
              <h2 className={styles.title}>New here?</h2>
              <p>Create an account and every solve, note and revision is saved to it.</p>
              <button type="button" className={styles.ghost} onClick={() => setMode("signup")}>
                Sign up
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function AuthForm({
  mode,
  next,
  providers,
  onSwitch,
}: {
  mode: Mode;
  next: string;
  providers: SocialProvider[];
  onSwitch: () => void;
}) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const signup = mode === "signup";

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    const { error } = signup
      ? await authClient.signUp.email({ email, password, name: name.trim() || email.split("@")[0] })
      : await authClient.signIn.email({ email, password });
    if (error) {
      setError(error.message || (signup ? "Couldn't create the account." : "Couldn't sign in."));
      setBusy(false);
      return;
    }
    // Full reload so the server-rendered layout picks up the new session.
    window.location.href = next;
  }

  async function social(provider: SocialProvider) {
    setBusy(true);
    setError("");
    const { error } = await authClient.signIn.social({ provider, callbackURL: next, errorCallbackURL: "/login" });
    if (error) {
      setError(error.message || `Couldn't reach ${PROVIDER_LABEL[provider]}.`);
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className={styles.form}>
      <h1 className={styles.title}>{signup ? "Create account" : "Sign in"}</h1>

      {providers.length ? (
        <>
          <div className={styles.social}>
            {providers.map((p) => (
              <button
                key={p}
                type="button"
                onClick={() => social(p)}
                disabled={busy}
                className={styles.socialButton}
                aria-label={`${signup ? "Sign up" : "Sign in"} with ${PROVIDER_LABEL[p]}`}
                title={PROVIDER_LABEL[p]}
              >
                {p === "github" ? <GitHubIcon /> : <GoogleIcon />}
              </button>
            ))}
          </div>
          <span className={styles.hint}>{signup ? "or use your email to register" : "or use your email"}</span>
        </>
      ) : null}

      {signup ? (
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Name"
          aria-label="Name"
          autoComplete="name"
          className={`field ${styles.input}`}
        />
      ) : null}
      <input
        type="email"
        required
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        placeholder="Email"
        aria-label="Email"
        autoComplete="email"
        className={`field ${styles.input}`}
      />
      <div className={styles.passwordWrap}>
        <input
          type={showPassword ? "text" : "password"}
          required
          minLength={8}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder={signup ? "Password (8+ characters)" : "Password"}
          aria-label="Password"
          autoComplete={signup ? "new-password" : "current-password"}
          className={`field ${styles.input} ${styles.passwordInput}`}
        />
        <button
          type="button"
          onClick={() => setShowPassword((v) => !v)}
          className={styles.eye}
          aria-label={showPassword ? "Hide password" : "Show password"}
          aria-pressed={showPassword}
          title={showPassword ? "Hide password" : "Show password"}
        >
          <EyeIcon open={showPassword} />
        </button>
      </div>

      {error ? <p className={styles.error}>{error}</p> : null}
      <button disabled={busy} className={`btn-primary ${styles.submit}`}>
        {busy ? "Please wait…" : signup ? "Sign up" : "Sign in"}
      </button>

      <p className={styles.mobileSwitch}>
        {signup ? "Already have an account? " : "New here? "}
        <button type="button" onClick={onSwitch} className="text-brass2 underline">
          {signup ? "Sign in" : "Create an account"}
        </button>
      </p>
    </form>
  );
}

/** Open eye while the password is visible; struck through while hidden. */
function EyeIcon({ open }: { open: boolean }) {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12Z" />
      <circle cx="12" cy="12" r="3" />
      {open ? null : <path d="M3 3l18 18" />}
    </svg>
  );
}

function GitHubIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M12 .5C5.73.5.5 5.73.5 12a11.5 11.5 0 0 0 7.86 10.92c.58.1.79-.25.79-.56v-2c-3.2.7-3.88-1.37-3.88-1.37-.52-1.33-1.28-1.68-1.28-1.68-1.04-.71.08-.7.08-.7 1.16.08 1.77 1.19 1.77 1.19 1.03 1.76 2.7 1.25 3.36.96.1-.75.4-1.25.73-1.54-2.55-.29-5.24-1.28-5.24-5.68 0-1.26.45-2.28 1.19-3.09-.12-.29-.52-1.46.11-3.05 0 0 .97-.31 3.17 1.18a11 11 0 0 1 5.77 0c2.2-1.49 3.17-1.18 3.17-1.18.63 1.59.23 2.76.11 3.05.74.81 1.19 1.83 1.19 3.09 0 4.41-2.69 5.39-5.25 5.67.41.36.78 1.06.78 2.14v3.17c0 .31.21.67.8.56A11.5 11.5 0 0 0 23.5 12C23.5 5.73 18.27.5 12 .5Z" />
    </svg>
  );
}

function GoogleIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true">
      <path fill="#EA4335" d="M12 10.2v3.9h5.5c-.24 1.4-1.7 4.1-5.5 4.1-3.3 0-6-2.7-6-6.2s2.7-6.2 6-6.2c1.9 0 3.1.8 3.8 1.5l2.6-2.5C16.8 3.3 14.6 2.3 12 2.3 6.7 2.3 2.4 6.6 2.4 12s4.3 9.7 9.6 9.7c5.5 0 9.2-3.9 9.2-9.4 0-.6-.07-1.1-.16-1.6H12Z" />
    </svg>
  );
}
