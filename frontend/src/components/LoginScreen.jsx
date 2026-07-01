import { useState } from "react";
import { EyeIcon, EyeOffIcon } from "./Icons";

export default function LoginScreen({ loading, error, onLogin }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);

  function handleSubmit(event) {
    event.preventDefault();
    onLogin({
      email: email.trim(),
      password,
    });
  }

  return (
    <main className="login-screen">
      <section className="login-screen__card" aria-labelledby="login-title">
        <div className="login-screen__intro">
          <div className="login-screen__eyebrow">Speech Request System</div>
          <h1 className="login-screen__title" id="login-title">
            Log in
          </h1>
          <p className="login-screen__copy">
            Use your employee or manager email and password to continue to the request workflow.
          </p>
        </div>

        <form className="login-screen__form" onSubmit={handleSubmit}>
          <label className="field login-screen__field">
            <input
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              placeholder="Email address"
              autoComplete="username"
              className="login-screen__input"
              disabled={loading}
              required
            />
          </label>

          <label className="field login-screen__field">
            <div className="login-screen__password-wrap">
              <input
                type={showPassword ? "text" : "password"}
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                placeholder="Password"
                autoComplete="current-password"
                className="login-screen__input login-screen__input--password"
                disabled={loading}
                required
              />
              <button
                type="button"
                className="login-screen__password-toggle"
                aria-label={showPassword ? "Hide password" : "Show password"}
                onClick={() => setShowPassword((current) => !current)}
                disabled={loading}
              >
                {showPassword ? <EyeOffIcon /> : <EyeIcon />}
              </button>
            </div>
          </label>

          {error ? <div className="error">{error}</div> : null}

          <button className="btn btn-primary login-screen__submit" type="submit" disabled={loading || !email.trim() || !password}>
            {loading ? "Signing in..." : "Continue"}
          </button>
        </form>
      </section>
    </main>
  );
}
