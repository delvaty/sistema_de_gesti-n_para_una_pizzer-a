import { BrowserRouter as Router, Route, Routes } from 'react-router-dom';
import Layout from './components/Layout';
import Home from './pages/Home';
import Login from './pages/Login';
import SignUp from './pages/SignUp';
import Cart from './pages/Cart';
import Orders from './pages/Orders';
import AdminPizzas from './pages/AdminPizzas';
import DriverPanel from './pages/DriverPanel';
import ProtectedRoute from './components/ProtectedRoute';

function App() {
  return (
    <Router>
      <Layout>
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/login" element={<Login />} />
          <Route path="/signup" element={<SignUp />} />
          <Route path="/cart" element={<Cart />} />

          <Route
            path="/orders"
            element={
              <ProtectedRoute>
                <Orders />
              </ProtectedRoute>
            }
          />

          {/* Ruta para administrar pizzas: solo admins */}
          <Route
            path="/admin/pizzas"
            element={
              <ProtectedRoute allowedRoles={['admin']}>
                <AdminPizzas />
              </ProtectedRoute>
            }
          />

          {/* Ruta para repartidores: drivers y admins pueden ver el panel de repartidor */}
          <Route
            path="/driver"
            element={
              <ProtectedRoute allowedRoles={['driver', 'admin']}>
                <DriverPanel />
              </ProtectedRoute>
            }
          />
        </Routes>
      </Layout>
    </Router>
  );
}

export default App;
