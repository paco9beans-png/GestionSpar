import { BarChart3, ClipboardList, Home, Package, Users } from 'lucide-react';
import { NavLink } from 'react-router-dom';

const tabs = [
  { to: '/inicio', icon: Home, label: 'Inicio' },
  { to: '/clientes', icon: Users, label: 'Clientes' },
  { to: '/productos', icon: Package, label: 'Productos' },
  { to: '/pedidos', icon: ClipboardList, label: 'Pedidos' },
  { to: '/estadisticas', icon: BarChart3, label: 'Estadísticas' },
];

export function BottomNav() {
  return (
    <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-border/60 bg-card/95 pb-[env(safe-area-inset-bottom)] backdrop-blur">
      <div className="mx-auto flex max-w-md items-stretch justify-around px-2 py-1.5">
        {tabs.map(({ to, icon: Icon, label }) => (
          <NavLink
            key={to}
            to={to}
            className={({ isActive }) =>
              `flex flex-1 flex-col items-center gap-0.5 rounded-xl py-1.5 text-[11px] font-medium transition-colors ${
                isActive ? 'text-primary' : 'text-muted-foreground'
              }`
            }
          >
            {({ isActive }) => (
              <>
                <span
                  className={`grid size-8 place-items-center rounded-full transition-colors ${
                    isActive ? 'bg-primary-soft' : ''
                  }`}
                >
                  <Icon className="size-5" />
                </span>
                {label}
              </>
            )}
          </NavLink>
        ))}
      </div>
    </nav>
  );
}
