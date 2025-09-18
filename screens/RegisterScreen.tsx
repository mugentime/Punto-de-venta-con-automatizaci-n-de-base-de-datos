import React, { useState } from 'react';
import { useAppContext } from '../contexts/AppContext';

interface RegisterScreenProps {
  onSwitchToLogin: () => void;
}

const RegisterScreen: React.FC<RegisterScreenProps> = ({ onSwitchToLogin }) => {
  const { register } = useAppContext();
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [success, setSuccess] = useState(false);

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    
    if (password.length < 4) {
        setError('La contraseña debe tener al menos 4 caracteres.');
        return;
    }
    
    setIsLoading(true);
    try {
      await register({ username, email, password });
      setSuccess(true);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  if (success) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-100">
        <div className="w-full max-w-sm p-8 space-y-4 bg-white rounded-3xl shadow-lg text-center">
          <h2 className="text-2xl font-bold tracking-tight text-slate-900">
            ¡Registro Exitoso!
          </h2>
          <p className="text-slate-600">
            Tu cuenta ha sido creada. Un administrador la revisará y aprobará pronto.
          </p>
          <button
            onClick={onSwitchToLogin}
            className="w-full justify-center rounded-xl border border-transparent bg-zinc-900 py-2 px-4 text-sm font-medium text-white shadow-sm hover:bg-zinc-800"
          >
            Volver a Inicio de Sesión
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex items-center justify-center min-h-screen bg-gray-100">
      <div className="w-full max-w-sm p-8 space-y-6 bg-white rounded-3xl shadow-lg">
        <div className="text-center">
            <img 
                src="data:image/png;base64,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" 
                alt="Conejo Negro Café Logo"
                className="mx-auto h-20 w-20"
            />
          <h2 className="mt-4 text-center text-2xl font-bold tracking-tight text-slate-900">
            Crear Cuenta de Empleado
          </h2>
        </div>
        <form className="mt-6 space-y-6" onSubmit={handleRegister}>
          <div>
            <label htmlFor="username" className="block text-sm font-medium text-slate-700">
              Usuario
            </label>
            <div className="mt-1">
              <input
                id="username"
                name="username"
                type="text"
                autoComplete="username"
                required
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                className="block w-full appearance-none rounded-xl border border-slate-300 px-3 py-2 placeholder-slate-400 shadow-sm focus:border-zinc-500 focus:outline-none focus:ring-zinc-500 sm:text-sm"
              />
            </div>
          </div>
          
          <div>
            <label htmlFor="email" className="block text-sm font-medium text-slate-700">
              Correo Electrónico
            </label>
            <div className="mt-1">
              <input
                id="email"
                name="email"
                type="email"
                autoComplete="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="block w-full appearance-none rounded-xl border border-slate-300 px-3 py-2 placeholder-slate-400 shadow-sm focus:border-zinc-500 focus:outline-none focus:ring-zinc-500 sm:text-sm"
              />
            </div>
          </div>

          <div>
            <label htmlFor="password"className="block text-sm font-medium text-slate-700">
              Contraseña
            </label>
            <div className="mt-1">
              <input
                id="password"
                name="password"
                type="password"
                autoComplete="new-password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="block w-full appearance-none rounded-xl border border-slate-300 px-3 py-2 placeholder-slate-400 shadow-sm focus:border-zinc-500 focus:outline-none focus:ring-zinc-500 sm:text-sm"
              />
            </div>
          </div>

          {error && <p className="text-sm text-red-600 text-center">{error}</p>}

          <div>
            <button
              type="submit"
              disabled={isLoading}
              className="flex w-full justify-center rounded-xl border border-transparent bg-zinc-900 py-2 px-4 text-sm font-medium text-white shadow-sm hover:bg-zinc-800 focus:outline-none focus:ring-2 focus:ring-zinc-500 focus:ring-offset-2 disabled:bg-zinc-400"
            >
              {isLoading ? 'Registrando...' : 'Registrar'}
            </button>
          </div>
        </form>

        <p className="mt-6 text-center text-sm text-slate-600">
          ¿Ya tienes una cuenta?{' '}
          <button onClick={onSwitchToLogin} className="font-medium text-zinc-700 hover:text-zinc-600">
            Inicia Sesión
          </button>
        </p>
      </div>
    </div>
  );
};

export default RegisterScreen;
