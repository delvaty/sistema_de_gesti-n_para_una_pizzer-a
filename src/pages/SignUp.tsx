import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabaseClient';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/Select';
import { LoaderCircle } from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';

export default function SignUp() {
  const [loading, setLoading] = useState(false);
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState('user');
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [passwordStrength, setPasswordStrength] = useState<'débil' | 'media' | 'fuerte' | null>(null);

  const navigate = useNavigate();
  const { session } = useAuth();

  useEffect(() => {
    if (session) {
      navigate('/');
    }
  }, [session, navigate]);

  // Función para evaluar la fortaleza de la contraseña
  const evaluatePasswordStrength = (password: string) => {
    if (password.length === 0) {
      setPasswordStrength(null);
      return;
    }

    let score = 0;
    
    // Longitud mínima
    if (password.length >= 8) score++;
    if (password.length >= 12) score++;
    
    // Diversidad de caracteres
    if (/[A-Z]/.test(password)) score++; // Mayúsculas
    if (/[a-z]/.test(password)) score++; // Minúsculas
    if (/[0-9]/.test(password)) score++; // Números
    if (/[^A-Za-z0-9]/.test(password)) score++; // Símbolos
    
    // Determinar nivel de fortaleza
    if (score <= 2) {
      setPasswordStrength('débil');
    } else if (score <= 4) {
      setPasswordStrength('media');
    } else {
      setPasswordStrength('fuerte');
    }
  };

  const handlePasswordChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newPassword = e.target.value;
    setPassword(newPassword);
    evaluatePasswordStrength(newPassword);
  };

  const isPasswordStrong = () => {
    if (!passwordStrength) return false;
    return passwordStrength === 'fuerte';
  };

  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Validar contraseña fuerte antes de registrar
    if (!isPasswordStrong()) {
      setError('Por favor, usa una contraseña más segura para registrarte.');
      return;
    }

    try {
      setLoading(true);
      setError(null);
      setMessage(null);

      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: {
            full_name: fullName,
            role: role,
          },
        },
      });

      if (error) throw error;

      if (!data.session) {
        setMessage('¡Registro exitoso! Revisa tu correo para verificar tu cuenta.');
      }

    } catch (err: unknown) {
      if (err instanceof Error) {
        setError(err.message);
      } else {
        setError('Ocurrió un error inesperado');
      }
    } finally {
      setLoading(false);
    }
  };

  // Función para obtener el color del indicador de fortaleza
  const getStrengthColor = () => {
    switch (passwordStrength) {
      case 'débil': return 'bg-red-500';
      case 'media': return 'bg-yellow-500';
      case 'fuerte': return 'bg-green-500';
      default: return 'bg-gray-300';
    }
  };

  // Función para obtener el texto de recomendaciones
  const getPasswordRecommendations = () => {
    const recommendations = [];
    
    if (password.length < 8) {
      recommendations.push('Al menos 8 caracteres');
    }
    if (!/[A-Z]/.test(password)) {
      recommendations.push('Una letra mayúscula');
    }
    if (!/[a-z]/.test(password)) {
      recommendations.push('Una letra minúscula');
    }
    if (!/[0-9]/.test(password)) {
      recommendations.push('Un número');
    }
    if (!/[^A-Za-z0-9]/.test(password)) {
      recommendations.push('Un símbolo especial');
    }
    
    return recommendations;
  };

  return (
    <div className="flex min-h-[80vh] items-center justify-center">
      <div className="w-full max-w-md space-y-8 rounded-xl border border-border bg-surface p-10">
        <div>
          <h2 className="text-center font-serif text-3xl font-bold">Crear una Cuenta</h2>
          <p className="mt-2 text-center text-sm text-text-secondary">
            Regístrate para empezar a pedir las mejores pizzas.
          </p>
        </div>
        <form className="mt-8 space-y-6" onSubmit={handleSignUp}>
          <div className="space-y-4 rounded-md shadow-sm">
            <div>
              <Input
                id="full-name"
                name="fullName"
                type="text"
                required
                placeholder="Nombre Completo"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
              />
            </div>
            <div>
              <Input
                id="email-address"
                name="email"
                type="email"
                autoComplete="email"
                required
                placeholder="Correo electrónico"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Input
                id="password"
                name="password"
                type="password"
                autoComplete="new-password"
                required
                placeholder="Contraseña"
                value={password}
                onChange={handlePasswordChange}
              />
              
              {/* Indicador de fortaleza de contraseña */}
              {password && (
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-text-secondary">Fortaleza:</span>
                    <span className={`text-xs font-medium ${
                      passwordStrength === 'débil' ? 'text-red-500' :
                      passwordStrength === 'media' ? 'text-yellow-500' :
                      passwordStrength === 'fuerte' ? 'text-green-500' : 'text-text-secondary'
                    }`}>
                      {passwordStrength ? passwordStrength.charAt(0).toUpperCase() + passwordStrength.slice(1) : ''}
                    </span>
                  </div>
                  
                  {/* Barra de progreso visual */}
                  <div className="h-2 w-full bg-gray-200 rounded-full overflow-hidden">
                    <div 
                      className={`h-full transition-all duration-300 ${getStrengthColor()}`}
                      style={{
                        width: passwordStrength === 'débil' ? '33%' : 
                               passwordStrength === 'media' ? '66%' : 
                               passwordStrength === 'fuerte' ? '100%' : '0%'
                      }}
                    />
                  </div>
                  
                  {/* Recomendaciones */}
                  {passwordStrength !== 'fuerte' && password.length > 0 && (
                    <div className="text-xs text-text-secondary">
                      <p className="font-medium mb-1">Para una contraseña fuerte:</p>
                      <ul className="list-disc list-inside space-y-1">
                        {getPasswordRecommendations().map((rec, index) => (
                          <li key={index}>{rec}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                  
                  {passwordStrength === 'fuerte' && (
                    <p className="text-xs text-green-500 font-medium">
                      ✓ Tu contraseña es segura
                    </p>
                  )}
                </div>
              )}
            </div>

            {/* SELECT: solo Cliente y Repartidor */}
            <div>
              <Select onValueChange={setRole} defaultValue={role}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecciona un rol" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="user">Cliente</SelectItem>
                  <SelectItem value="driver">Repartidor</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {error && <p className="text-sm text-red-500">{error}</p>}
          {message && <p className="text-sm text-green-500">{message}</p>}

          <div>
            <Button 
              type="submit" 
              className="w-full" 
              size="lg" 
              disabled={loading || (password.length > 0 && !isPasswordStrong())}
            >
              {loading && <LoaderCircle className="mr-2 h-4 w-4 animate-spin" />}
              {loading ? 'Creando cuenta...' : 'Registrarse'}
            </Button>
          </div>
        </form>
        <p className="mt-4 text-center text-sm text-text-secondary">
          ¿Ya tienes una cuenta?{' '}
          <Link to="/login" className="font-medium text-primary hover:underline">
            Inicia sesión
          </Link>
        </p>
      </div>
    </div>
  );
}