import { useState, type FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import "../styles/auth.css";

function ForgotPassword() {
  const navigate = useNavigate();

  const [correo, setCorreo] = useState("");
  const [error, setError] = useState("");
  const [mensaje, setMensaje] = useState("");

  const correoInstitucionalValido = (correoIngresado: string) => {
    const correoNormalizado = correoIngresado.toLowerCase().trim();

    return (
      correoNormalizado.endsWith("@uandresbello.edu") ||
      correoNormalizado.endsWith("@unab.cl")
    );
  };

  const handleSubmit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();

    if (!correo) {
      setError("Ingresa tu correo electrónico.");
      setMensaje("");
      return;
    }

    if (!correoInstitucionalValido(correo)) {
      setError("Debes utilizar un correo institucional.");
      setMensaje("");
      return;
    }

    setError("");
    setMensaje(
      "Enlace de recuperación enviado correctamente."
    );
  };

  return (
    <main className="auth-page">
      <section className="auth-container forgot-container">
        <div className="brand">
          <div className="brand-icon">
            <svg
              viewBox="0 0 24 24"
              width="28"
              height="28"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
            >
              <rect x="4" y="5" width="16" height="12" rx="2" />
              <path d="M7 17v2M17 17v2M4 10h16M8 7h3M13 7h3" />
              <circle cx="8" cy="17" r="1" />
              <circle cx="16" cy="17" r="1" />
            </svg>
          </div>

          <div>
            <h1>UNAB Transporte</h1>
            <p>Sistema de gestión de rutas</p>
          </div>
        </div>

        <div className="auth-header forgot-header">
          <h2>Recuperar contraseña</h2>

          <p>
            Ingresa tu correo y te enviaremos un enlace para
            restablecer tu contraseña.
          </p>
        </div>

        <form className="auth-form" onSubmit={handleSubmit}>
          <div className="form-group">
            <label htmlFor="correo">
              Correo electrónico
            </label>

            <input
              id="correo"
              type="email"
              placeholder="Correo institucional"
              value={correo}
              onChange={(e) => setCorreo(e.target.value)}
            />

            <p className="field-help">
              Usa el correo asociado a tu cuenta.
            </p>
          </div>

          {error && <p className="form-error">{error}</p>}

          {mensaje && (
            <p className="form-success">{mensaje}</p>
          )}

          <button type="submit" className="primary-button">
            Enviar enlace de recuperación
          </button>
        </form>

        <button
          type="button"
          className="back-login-button"
          onClick={() => navigate("/login")}
        >
          ← Volver a iniciar sesión
        </button>

        <p className="forgot-footer">
          Uso exclusivo para colaboradores y académicos UNAB.
        </p>
      </section>
    </main>
  );
}

export default ForgotPassword;