import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Lock, Eye, EyeOff, Phone } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { Logo } from '@/components/Logo';

// ⭐ Use your own image from /public/portfolio/
const HERO_IMAGE = '/portfolio/slide-1.png';

export function LoginPage() {
  const { signIn } = useAuth();
  const navigate = useNavigate();
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    const { error } = await signIn(phone, password);
    setLoading(false);

    if (error) {
      setError(error);
    } else {
      navigate('/app');
    }
  };

  return (
    <div className="min-h-screen flex flex-col bg-[#F5F7F5]">
      <div className="flex-1 flex flex-col justify-center px-6 pb-10 max-w-md mx-auto w-full pt-10">
        <div className="mb-6 flex justify-center animate-fade-in">
          <Logo size="lg" />
        </div>

        {/* Card with image background */}
        <div className="relative rounded-2xl overflow-hidden animate-slide-up border border-[#E8EDE8] shadow-lg">
          {/* Background image */}
          <div
            className="absolute inset-0 bg-cover bg-center bg-no-repeat"
            style={{ backgroundImage: `url(${HERO_IMAGE})` }}
          />
          {/* Dark overlay for readability */}
          <div className="absolute inset-0 bg-gradient-to-b from-black/65 via-black/75 to-black/85" />
          {/* Green tint */}
          <div className="absolute inset-0 bg-gradient-to-br from-[#007A33]/25 via-transparent to-[#00A04A]/15" />

          {/* Content */}
          <div className="relative p-7">
            <h1
              className="text-2xl font-bold text-white mb-1"
              style={{ textShadow: '0 2px 8px rgba(0,0,0,0.7)' }}
            >
              Welcome back
            </h1>
            <p
              className="text-sm text-white/80 mb-6"
              style={{ textShadow: '0 1px 4px rgba(0,0,0,0.7)' }}
            >
              Sign in to your Heineken account
            </p>

            {error && (
              <div className="mb-4 px-4 py-3 rounded-xl bg-red-500/20 border border-red-400/40 text-sm text-red-100 backdrop-blur-sm">
                {error}
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-white/90 uppercase tracking-wide mb-1.5">
                  Phone Number
                </label>
                <div className="relative">
                  <Phone
                    size={18}
                    className="absolute left-3.5 top-1/2 -translate-y-1/2 text-white/70 z-10"
                  />
                  <input
                    type="tel"
                    required
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="+234 803 000 0000"
                    className="w-full bg-white/95 backdrop-blur-sm border border-white/40 rounded-xl pl-11 pr-4 py-3 text-sm text-[#0A2A1A] placeholder-[#8A9A90] outline-none focus:border-[#00A04A] focus:ring-2 focus:ring-[#00A04A]/30 transition-all"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-white/90 uppercase tracking-wide mb-1.5">
                  Password
                </label>
                <div className="relative">
                  <Lock
                    size={18}
                    className="absolute left-3.5 top-1/2 -translate-y-1/2 text-white/70 z-10"
                  />
                  <input
                    type={showPassword ? 'text' : 'password'}
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    className="w-full bg-white/95 backdrop-blur-sm border border-white/40 rounded-xl pl-11 pr-11 py-3 text-sm text-[#0A2A1A] placeholder-[#8A9A90] outline-none focus:border-[#00A04A] focus:ring-2 focus:ring-[#00A04A]/30 transition-all"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((v) => !v)}
                    className="absolute right-3.5 top-1/2 -translate-y-1/2 text-[#4A5A50] hover:text-[#007A33] z-10"
                  >
                    {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                  </button>
                </div>
              </div>

              <div className="flex justify-end">
                <button
                  type="button"
                  className="text-xs text-[#00A04A] hover:text-[#007A33] transition-colors font-semibold"
                  style={{ textShadow: '0 1px 4px rgba(0,0,0,0.6)' }}
                >
                  Forgot password?
                </button>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full bg-gradient-to-r from-[#007A33] to-[#005A26] text-white font-bold py-3 rounded-xl hover:from-[#00A04A] hover:to-[#007A33] shadow-lg transition-all disabled:opacity-50"
              >
                {loading ? 'Signing in...' : 'Sign In'}
              </button>
            </form>

            <p
              className="text-center text-sm text-white/80 mt-6"
              style={{ textShadow: '0 1px 4px rgba(0,0,0,0.7)' }}
            >
              Don't have an account?{' '}
              <Link to="/signup" className="text-[#00A04A] font-semibold hover:text-[#00A04A]/80">
                Sign up
              </Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}