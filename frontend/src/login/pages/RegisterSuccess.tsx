import { useNavigate } from "react-router-dom";
import MarcaAuth from "../components/MarcaAuth";
import "../styles/auth.css";

function RegisterSuccess() {
  const navigate = useNavigate();

  return (
    <main className="auth-page">
      <section className="auth-container">
        <MarcaAuth />

        <div className="success-card">
          {/* decorativo: el lector de pantalla no lee el sobre */}
          <div className="success-icon" aria-hidden="true">✉</div>

          <div>
            <h2>Registro enviado</h2>
            <p>Tu solicitud ya está en revisión</p>
          </div>

          <p className="success-message">
            Debes esperar la confirmación de un administrador.
            Se te enviará un correo cuando tu cuenta sea
            aprobada.
          </p>

          <div className="success-info">
            Revisa tu bandeja de entrada y la carpeta de spam.
          </div>
        </div>

        <button
          type="button"
          className="primary-button success-button"
          onClick={() => navigate("/login")}
        >
          Volver al inicio
        </button>

        <p className="auth-switch">
          ¿Ya tienes una cuenta?{" "}
          <button
            type="button"
            className="link-button"
            onClick={() => navigate("/login")}
          >
            Inicia sesión
          </button>
        </p>
      </section>
    </main>
  );
}

export default RegisterSuccess;