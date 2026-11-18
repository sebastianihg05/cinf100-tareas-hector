import { useState, type FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "../../api";
import { esCorreoInstitucional, normalizarTelefono } from "../../admin/utils/format";
import CampoContrasena from "../components/CampoContrasena";
import MarcaAuth from "../components/MarcaAuth";
import "../styles/auth.css";

function Register() {
  const navigate = useNavigate();

  const [nombre, setNombre] = useState("");
  const [correo, setCorreo] = useState("");
  const [sede, setSede] = useState("");
  const [telefono, setTelefono] = useState("");
  const [password, setPassword] = useState("");
  const [confirmarPassword, setConfirmarPassword] = useState("");

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
        <MarcaAuth />

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
              autoComplete="name"
              aria-required="true"
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
              autoComplete="email"
              aria-required="true"
              aria-describedby="correo-ayuda"
            />
            <p id="correo-ayuda" className="field-help">Termina en @unab.cl o @uandresbello.edu.</p>
          </div>

          <div className="form-group">
            <label htmlFor="sede">Sede</label>

            <select
              id="sede"
              value={sede}
              onChange={(e) => setSede(e.target.value)}
              aria-required="true"
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
              autoComplete="tel"
              aria-required="true"
              aria-describedby="telefono-ayuda"
            />
            <p id="telefono-ayuda" className="field-help">Celular chileno, por ejemplo +56 9 1234 5678.</p>
          </div>

          <CampoContrasena
            id="password"
            etiqueta="Contraseña"
            valor={password}
            onCambiar={setPassword}
            placeholder="Mínimo 8 caracteres"
            autoComplete="new-password"
            ayuda="Mínimo 8 caracteres."
          />

          <CampoContrasena
            id="confirmarPassword"
            etiqueta="Confirmar contraseña"
            valor={confirmarPassword}
            onCambiar={setConfirmarPassword}
            placeholder="Repite tu contraseña"
            autoComplete="new-password"
          />

          {/* VIS-03: role="alert" hace que el lector de pantalla lea el error apenas aparece */}
          {error && <p className="form-error" role="alert">{error}</p>}

          <button type="submit" className="primary-button" disabled={enviando}>
            {enviando ? "Creando cuenta…" : "Crear cuenta"}
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