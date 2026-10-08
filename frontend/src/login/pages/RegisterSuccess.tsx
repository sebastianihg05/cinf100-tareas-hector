import { useNavigate } from "react-router-dom";
import "../styles/auth.css";

function RegisterSuccess() {
  const navigate = useNavigate();

  return (
    <main className="auth-page">
      <section className="auth-container">
        <div className="brand">
          <div className="brand-icon">✉</div>

          <div>
            <h1>UNAB Transporte</h1>
            <p>Sistema de gestión de rutas</p>
          </div>
        </div>

        <div className="success-card">
          <div className="success-icon">✉</div>

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