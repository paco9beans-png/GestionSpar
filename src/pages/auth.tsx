import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Loader2 } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { Button } from '@/components/ui/button';
import { Field, Input } from '@/components/ui/field';

export default function Auth() {
  const navigate = useNavigate();
  const [mode, setMode] = useState<'signin' | 'signup'>('signin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      if (mode === 'signup') {
        const { error: err } = await supabase.auth.signUp({ email, password });
        if (err) throw err;
        navigate('/inicio', { replace: true });
      } else {
        const { error: err } = await supabase.auth.signInWithPassword({ email, password });
        if (err) {
          setError('Email o contraseña incorrectos');
          return;
        }
        navigate('/inicio', { replace: true });
      }
    } catch (err) {
      setError(
        err instanceof Error && err.message.includes('already registered')
          ? 'Ya existe una cuenta con este email. Inicia sesión.'
          : 'No se pudo completar. Inténtalo de nuevo.',
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="min-h-dvh bg-background">
      <div className="bg-hero px-6 pb-16 pt-14 text-primary-foreground">
        <div className="mx-auto max-w-md">
          <div className="grid size-12 place-items-center rounded-2xl bg-card font-display text-2xl font-extrabold text-primary shadow-card">
            S
          </div>
          <h1 className="mt-5 font-display text-3xl font-extrabold leading-tight">
            Mi Gestión Comercial SPAR
          </h1>
          <p className="mt-2 text-sm text-primary-foreground/85">
            Clientes, productos, pedidos y estadísticas desde el móvil.
          </p>
        </div>
      </div>
      <div className="mx-auto -mt-8 max-w-md px-4">
        <form
          onSubmit={submit}
          className="space-y-4 rounded-3xl bg-card p-5 shadow-card"
        >
          <div className="grid grid-cols-2 gap-1 rounded-2xl bg-secondary p-1">
            {(['signin', 'signup'] as const).map((m) => (
              <button
                key={m}
                type="button"
                onClick={() => {
                  setMode(m);
                  setError(null);
                }}
                className={`rounded-xl py-2 text-xs font-semibold transition-colors ${
                  mode === m ? 'bg-card text-foreground shadow-card' : 'text-muted-foreground'
                }`}
              >
                {m === 'signin' ? 'Iniciar sesión' : 'Crear cuenta'}
              </button>
            ))}
          </div>
          <Field label="Email">
            <Input
              type="email"
              required
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="tu@email.com"
            />
          </Field>
          <Field label="Contraseña">
            <Input
              type="password"
              required
              minLength={6}
              autoComplete={mode === 'signup' ? 'new-password' : 'current-password'}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
            />
          </Field>
          {error && (
            <p className="rounded-xl bg-destructive/10 px-3.5 py-2.5 text-sm text-destructive">{error}</p>
          )}
          <Button type="submit" size="lg" className="w-full" loading={busy}>
            {busy ? (
              'Un momento…'
            ) : mode === 'signin' ? (
              'Entrar'
            ) : (
              'Crear cuenta'
            )}
          </Button>
        </form>
      </div>
    </div>
  );
}
