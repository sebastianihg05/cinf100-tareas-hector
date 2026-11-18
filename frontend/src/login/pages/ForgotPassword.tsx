import { useState, type FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import { esCorreoInstitucional } from "../../admin/utils/format";
import MarcaAuth from "../components/MarcaAuth";
import "../styles/auth.css";

function ForgotPassword() {
  const navigate = useNavigate();

  const [correo, setCorreo] = useState("");
  const [error, setError] = useState("");
  const [mensaje, setMensaje] = useState("");

  const handleSubmit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();

    if (!correo) {
      setError("Ingresa tu correo electrónico.");
      setMensaje("");
      return;
    }

    if (!esCorreoInstitucional(correo)) {
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
        <MarcaAuth />

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
              autoComplete="email"
              aria-required="true"
              aria-describedby="correo-ayuda"
            />

            <p id="correo-ayuda" className="field-help">
              Usa el correo asociado a tu cuenta.
            </p>
          </div>

          {error && <p className="form-error" role="alert">{error}</p>}

          {mensaje && (
            <p className="form-success" role="status">{mensaje}</p>
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