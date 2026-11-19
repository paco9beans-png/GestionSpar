import { Navigate, Route, Routes } from 'react-router-dom';
import { useSession } from '@/lib/session';
import { BottomNav } from '@/components/bottom-nav';
import Auth from '@/pages/auth';
import Inicio from '@/pages/inicio';
import Clientes from '@/pages/clientes';
import ClienteDetalle from '@/pages/cliente-detalle';
import Productos from '@/pages/productos';
import Pedidos from '@/pages/pedidos';
import NuevoPedido from '@/pages/pedido-nuevo';
import PedidoDetalle from '@/pages/pedido-detalle';
import Estadisticas from '@/pages/estadisticas';
import Importar from '@/pages/importar';
import HojaRuta from '@/pages/hoja-ruta';
import FotosProductos from '@/pages/fotos-productos';

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div className="mx-auto min-h-dvh max-w-md bg-background">
      {children}
      <BottomNav />
    </div>
  );
}

function Protected({ children }: { children: React.ReactNode }) {
  const session = useSession();
  if (!session) return <Navigate to="/auth" replace />;
  return <>{children}</>;
}

export default function App() {
  const session = useSession();
  return (
    <Routes>
      <Route path="/auth" element={session ? <Navigate to="/inicio" replace /> : <Auth />} />
      <Route
        path="/inicio"
        element={
          <Protected>
            <Shell>
              <Inicio />
            </Shell>
          </Protected>
        }
      />
      <Route
        path="/clientes"
        element={
          <Protected>
            <Shell>
              <Clientes />
            </Shell>
          </Protected>
        }
      />
      <Route
        path="/clientes/:id"
        element={
          <Protected>
            <Shell>
              <ClienteDetalle />
            </Shell>
          </Protected>
        }
      />
      <Route
        path="/clientes/:id/hoja-ruta"
        element={
          <Protected>
            <HojaRuta />
          </Protected>
        }
      />
      <Route
        path="/fotos-productos"
        element={
          <Protected>
            <Shell>
              <FotosProductos />
            </Shell>
          </Protected>
        }
      />
      <Route
        path="/productos"
        element={
          <Protected>
            <Shell>
              <Productos />
            </Shell>
          </Protected>
        }
      />
      <Route
        path="/pedidos"
        element={
          <Protected>
            <Shell>
              <Pedidos />
            </Shell>
          </Protected>
        }
      />
      <Route
        path="/pedidos/nuevo"
        element={
          <Protected>
            <NuevoPedido />
          </Protected>
        }
      />
      <Route
        path="/pedidos/:id"
        element={
          <Protected>
            <Shell>
              <PedidoDetalle />
            </Shell>
          </Protected>
        }
      />
      <Route
        path="/estadisticas"
        element={
          <Protected>
            <Shell>
              <Estadisticas />
            </Shell>
          </Protected>
        }
      />
      <Route
        path="/importar"
        element={
          <Protected>
            <Shell>
              <Importar />
            </Shell>
          </Protected>
        }
      />
      <Route path="*" element={<Navigate to="/inicio" replace />} />
    </Routes>
  );
}
