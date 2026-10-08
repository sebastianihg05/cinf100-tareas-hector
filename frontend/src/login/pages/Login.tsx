import { useState, type FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import { useAdmin } from "../../admin/store/AdminContext";
import { ahoraISO, esCorreoInstitucional } from "../../admin/utils/format";
import { autenticar } from "../authDemo";
import { guardarSesion, RUTA_INICIO } from "../sesion";
import "../styles/auth.css";

function Login() {
  const navigate = useNavigate();
  const { state, patchPasajero, updateAdmin } = useAdmin();

  const [correo, setCorreo] = useState("");
  const [password, setPassword] = useState("");
  const [mostrarPassword, setMostrarPassword] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();

    if (!correo || !password) {
      setError("Completa todos los campos.");
      return;
    }

    if (!esCorreoInstitucional(correo)) {
      setError("Debes utilizar un correo institucional.");
      return;
    }

    // Busca entre las cuentas registradas: valida contraseña, aprobación, habilitación y rol.
    const resultado = await autenticar(correo, password, state);

    if (!resultado.ok) {
      setError(resultado.error);
      return;
    }

    setError("");
    guardarSesion(resultado.sesion);

    // El perfil muestra cuándo ingresó por última vez.
    const { pasajeroId } = resultado.sesion;
    if (pasajeroId) patchPasajero(pasajeroId, { ultimoIngreso: ahoraISO() });
    else updateAdmin({ ultimoIngreso: ahoraISO() });

    navigate(RUTA_INICIO[resultado.sesion.rol], { replace: true });
  };

  return (
    <main className="auth-page">
      <section className="auth-container">
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

        <div className="auth-header">
          <h2>Iniciar sesión</h2>
          <p>Ingresa tus credenciales para acceder al sistema</p>
        </div>

        <form className="auth-form" onSubmit={handleSubmit}>
          <div className="form-group">
            <label htmlFor="correo">Correo electrónico</label>

            <input
              id="correo"
              type="email"
              placeholder="Correo institucional"
              value={correo}
              onChange={(e) => setCorreo(e.target.value)}
            />
          </div>

          <div className="form-group">
            <label htmlFor="password">Contraseña</label>

            <div className="password-field">
              <input
                id="password"
                type={mostrarPassword ? "text" : "password"}
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />

              <button
                type="button"
                className="password-toggle"
                onClick={() =>
                  setMostrarPassword(!mostrarPassword)
                }
              >
                {mostrarPassword ? "Ocultar" : "Ver"}
              </button>
            </div>
          </div>

          <button
            type="button"
            className="forgot-password"
            onClick={() => navigate("/recuperar")}
          >
            ¿Olvidaste tu contraseña?
          </button>

          {error && <p className="form-error">{error}</p>}

          <button type="submit" className="primary-button">
            Ingresar al sistema
          </button>
        </form>

        <p className="exclusive-text">
          Uso exclusivo para colaboradores y académicos UNAB.
        </p>

        <div className="auth-divider" />

        <p className="auth-switch">
          ¿No tienes una cuenta?{" "}
          <button
            type="button"
            className="link-button"
            onClick={() => navigate("/registro")}
          >
            Regístrate
          </button>
        </p>
      </section>
    </main>
  );
}

export default Login;
