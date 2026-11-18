import { useState, type FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "../../api";
import CampoContrasena from "../components/CampoContrasena";
import MarcaAuth from "../components/MarcaAuth";
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
        <MarcaAuth />

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
              autoComplete="username"
              aria-required="true"
            />
          </div>

          <CampoContrasena
            id="password"
            etiqueta="Contraseña"
            valor={password}
            onCambiar={setPassword}
            placeholder="••••••••"
            autoComplete="current-password"
          />

          <button
            type="button"
            className="forgot-password"
            onClick={() => navigate("/recuperar")}
          >
            ¿Olvidaste tu contraseña?
          </button>

          {/* VIS-03: role="alert" hace que el lector de pantalla lea el error apenas aparece */}
          {error && <p className="form-error" role="alert">{error}</p>}

          <button type="submit" className="primary-button" disabled={enviando}>
            {enviando ? "Ingresando…" : "Ingresar al sistema"}
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
