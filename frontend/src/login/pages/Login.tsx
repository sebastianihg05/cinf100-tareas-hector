import { useState, type FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "../../api";
import { useAdmin } from "../../admin/store/AdminContext";
import { idLocalDe } from "../../admin/store/adminStore";
import { ahoraISO, esCorreoInstitucional } from "../../admin/utils/format";
import { guardarSesion, RUTA_INICIO } from "../sesion";
import "../styles/auth.css";

function Login() {
  const navigate = useNavigate();
  const { state, sincronizarCuentas, updateAdmin } = useAdmin();

  const [correo, setCorreo] = useState("");
  const [password, setPassword] = useState("");
  const [mostrarPassword, setMostrarPassword] = useState(false);
  const [error, setError] = useState("");
  const [enviando, setEnviando] = useState(false);

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

    // BD-18: el backend valida la contraseña y el estado de la cuenta (pendiente, rechazada o desactivada).
    setEnviando(true);
    const respuesta = await api.iniciarSesion(correo, password);
    setEnviando(false);

    if (!respuesta.ok) {
      setError(respuesta.error);
      return;
    }

    setError("");
    const { token, usuario } = respuesta.datos;
    const sesion = { correo: usuario.correo, nombre: usuario.nombreCompleto, token };

    // En la base el rol se llama "administrador"; en el frontend, "admin".
    if (usuario.rol === "administrador") {
      updateAdmin({ nombre: usuario.nombreCompleto, email: usuario.correo, ultimoIngreso: ahoraISO() });
      guardarSesion({ ...sesion, rol: "admin", pasajeroId: null });
      navigate(RUTA_INICIO.admin, { replace: true });
      return;
    }

    // Funcionario o conductor: su cuenta se copia en la app para que vea sus datos y reservas.
    const rol = usuario.rol ?? "funcionario";
    sincronizarCuentas([usuario]);
    guardarSesion({ ...sesion, rol, pasajeroId: idLocalDe(state.pasajeros, usuario) });
    navigate(RUTA_INICIO[rol], { replace: true });
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

          <button type="submit" className="primary-button" disabled={enviando}>
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
