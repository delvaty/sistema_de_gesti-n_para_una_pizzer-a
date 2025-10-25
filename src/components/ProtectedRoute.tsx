// import { Navigate } from 'react-router-dom';
// import { useAuth } from '../hooks/useAuth';
// import { LoaderCircle } from 'lucide-react';

// interface ProtectedRouteProps {
//   children: React.ReactNode;
// }

// export default function ProtectedRoute({ children }: ProtectedRouteProps) {
//   const { isAuthenticated, loading } = useAuth();

//   if (loading) {
//     return (
//       <div className="flex h-screen items-center justify-center">
//         <LoaderCircle className="h-12 w-12 animate-spin text-primary" />
//       </div>
//     );
//   }

//   if (!isAuthenticated) {
//     return <Navigate to="/login" replace />;
//   }

//   return <>{children}</>;
// }
import React from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { LoaderCircle } from 'lucide-react';

interface ProtectedRouteProps {
  children: React.ReactNode;
  /**
   * allowedRoles: lista de roles permitidos para acceder.
   * Si se omite, la ruta solo requiere autenticación.
   * Ejemplos:
   *  - allowedRoles={['admin']}
   *  - allowedRoles={['driver','admin']}
   */
  allowedRoles?: string[];
}

export default function ProtectedRoute({ children, allowedRoles }: ProtectedRouteProps) {
  const { isAuthenticated, loading, user, profile } = useAuth();

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center">
        <LoaderCircle className="h-12 w-12 animate-spin text-primary" />
      </div>
    );
  }

  if (!isAuthenticated) {
    // no autenticado -> login
    return <Navigate to="/login" replace />;
  }

  // Si no se requieren roles especiales, devolvemos el contenido
  if (!allowedRoles || allowedRoles.length === 0) {
    return <>{children}</>;
  }

  // Determinar role defensivamente (profile, user, user_metadata)
  const role =
    (profile as any)?.role ??
    (user as any)?.role ??
    (user as any)?.user_metadata?.role ??
    null;

  // Si role no está definido o no está en la lista -> redirigir al home
  if (!role || !allowedRoles.includes(role)) {
    return <Navigate to="/" replace />;
  }

  // Passed all checks
  return <>{children}</>;
}
