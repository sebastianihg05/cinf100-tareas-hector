import { useState, type FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "../../api";
import { esCorreoInstitucional, normalizarTelefono } from "../../admin/utils/format";
import "../styles/auth.css";

function Register() {
  const navigate = useNavigate();

  const [nombre, setNombre] = useState("");
  const [correo, setCorreo] = useState("");
  const [sede, setSede] = useState("");
  const [telefono, setTelefono] = useState("");
  const [password, setPassword] = useState("");
  const [confirmarPassword, setConfirmarPassword] = useState("");

  const [mostrarPassword, setMostrarPassword] = useState(false);
  const [mostrarConfirmacion, setMostrarConfirmacion] =
    useState(false);

  const [error, setError] = useState("");
  const [enviando, setEnviando] = useState(false);

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();

    if (
      !nombre ||
      !correo ||
      !sede ||
      !telefono ||
      !password ||
      !confirmarPassword
    ) {
      setError("Completa todos los campos.");
      return;
    }

    if (!esCorreoInstitucional(correo)) {
      setError("Debes utilizar un correo institucional.");
      return;
    }

    // El backend solo acepta celulares chilenos (se guardan como +569XXXXXXXX).
    if (!normalizarTelefono(telefono)) {
      setError("Ingresa un celular chileno válido, por ejemplo +56 9 1234 5678.");
      return;
    }

    if (password.length < 8) {
      setError("La contraseña debe tener al menos 8 caracteres.");
      return;
    }

    if (password !== confirmarPassword) {
      setError("Las contraseñas no coinciden.");
      return;
    }

    // BD-17: la solicitud se guarda en PostgreSQL, pendiente y sin rol hasta que el administrador la apruebe.
    // El backend vuelve a validar los datos y guarda solo el hash de la contraseña.
    setEnviando(true);
    const respuesta = await api.registrar({
      nombreCompleto: nombre,
      correo,
      contrasena: password,
      confirmacion: confirmarPassword,
      telefono,
      sede,
    });
    setEnviando(false);

    if (!respuesta.ok) {
      setError(respuesta.error);
      return;
    }

    setError("");
    navigate("/registro/exito");
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
          <h2>Crear cuenta</h2>
          <p>Regístrate para reservar y gestionar tus viajes</p>
        </div>

        <form className="auth-form" onSubmit={handleSubmit}>
          <div className="form-group">
            <label htmlFor="nombre">Nombre completo</label>

            <input
              id="nombre"
              type="text"
              placeholder="Tu nombre y apellido"
              value={nombre}
              onChange={(e) => setNombre(e.target.value)}
            />
          </div>

          <div className="form-group">
            <label htmlFor="correo">Correo institucional</label>

            <input
              id="correo"
              type="email"
              placeholder="Correo institucional"
              value={correo}
              onChange={(e) => setCorreo(e.target.value)}
            />
          </div>

          <div className="form-group">
            <label htmlFor="sede">Sede</label>

            <select
              id="sede"
              value={sede}
              onChange={(e) => setSede(e.target.value)}
            >
              <option value="">Selecciona una sede</option>
              <option value="Quillota 980">Quillota 980</option>
              <option value="Quintay">Quintay</option>
              <option value="Rokamar">Rokamar</option>
              <option value="Santiago">Santiago</option>
            </select>
          </div>

          <div className="form-group">
            <label htmlFor="telefono">
              Teléfono de contacto
            </label>

            <input
              id="telefono"
              type="tel"
              placeholder="+56 9 1234 5678"
              value={telefono}
              onChange={(e) => setTelefono(e.target.value)}
            />
          </div>

          <div className="form-group">
            <label htmlFor="password">Contraseña</label>

            <div className="password-field">
              <input
                id="password"
                type={mostrarPassword ? "text" : "password"}
                placeholder="Mínimo 8 caracteres"
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

          <div className="form-group">
            <label htmlFor="confirmarPassword">
              Confirmar contraseña
            </label>

            <div className="password-field">
              <input
                id="confirmarPassword"
                type={
                  mostrarConfirmacion ? "text" : "password"
                }
                placeholder="Repite tu contraseña"
                value={confirmarPassword}
                onChange={(e) =>
                  setConfirmarPassword(e.target.value)
                }
              />

              <button
                type="button"
                className="password-toggle"
                onClick={() =>
                  setMostrarConfirmacion(!mostrarConfirmacion)
                }
              >
                {mostrarConfirmacion ? "Ocultar" : "Ver"}
              </button>
            </div>
          </div>

          {error && <p className="form-error">{error}</p>}

          <button type="submit" className="primary-button" disabled={enviando}>
            Crear cuenta
          </button>
        </form>

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

export default Register;