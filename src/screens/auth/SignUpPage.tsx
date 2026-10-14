import { useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { Lock, Eye, EyeOff, User, Phone, Gift, CheckCircle2 } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { Logo } from '@/components/Logo';

const HERO_IMAGE = '/portfolio/slide-1.png';

export function SignUpPage() {
  const { signUp, checkUserExists } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [referralCode, setReferralCode] = useState(searchParams.get('ref') || '');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (password !== confirmPassword) {
      setError('Passwords do not match! Please check and try again.');
      return;
    }

    if (password.length < 6) {
      setError('Password must be at least 6 characters long.');
      return;
    }

    const exists = await checkUserExists(phone);
    if (exists) {
      setError('An account with this phone number already exists. Please sign in.');
      return;
    }

    setLoading(true);
    const { error } = await signUp({
      password,
      fullName,
      phone,
      referralCode: referralCode || undefined,
    });
    setLoading(false);

    if (error) {
      setError(error);
    } else {
      setSuccess(true);
      setTimeout(() => navigate('/app'), 1800);
    }
  };

  if (success) {
    return (
      <div className="min-h-screen flex flex-col bg-[#F5F7F5]">
        <div className="flex-1 flex flex-col items-center justify-center px-6 max-w-md mx-auto w-full text-center">
          <div className="relative rounded-2xl overflow-hidden animate-slide-up border border-[#E8EDE8] shadow-lg w-full">
            <div
              className="absolute inset-0 bg-cover bg-center bg-no-repeat"
              style={{ backgroundImage: `url(${HERO_IMAGE})` }}
            />
            <div className="absolute inset-0 bg-gradient-to-b from-black/65 via-black/75 to-black/85" />
            <div className="absolute inset-0 bg-gradient-to-br from-[#007A33]/25 via-transparent to-[#00A04A]/15" />

            <div className="relative p-8">
              <div className="w-20 h-20 rounded-full bg-[#00A04A]/25 border border-[#00A04A]/50 flex items-center justify-center mx-auto mb-5 backdrop-blur-sm">
                <CheckCircle2 size={40} className="text-[#00A04A]" />
              </div>
              <h1
                className="text-2xl font-bold text-white mb-2"
                style={{ textShadow: '0 2px 8px rgba(0,0,0,0.7)' }}
              >
                Account created!
              </h1>
              <p
                className="text-white/85 text-sm"
                style={{ textShadow: '0 1px 4px rgba(0,0,0,0.7)' }}
              >
                Your Heineken account is ready with a{' '}
                <span className="text-[#00A04A] font-bold">₦500 welcome bonus</span> credited
                to your wallet. Taking you to your dashboard...
              </p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col bg-[#F5F7F5]">
      <div className="flex-1 flex flex-col justify-center px-6 pb-10 max-w-md mx-auto w-full pt-10">
        <div className="mb-6 flex justify-center animate-fade-in">
          <Logo size="lg" />
        </div>

        <div className="relative rounded-2xl overflow-hidden animate-slide-up border border-[#E8EDE8] shadow-lg">
          <div
            className="absolute inset-0 bg-cover bg-center bg-no-repeat"
            style={{ backgroundImage: `url(${HERO_IMAGE})` }}
          />
          <div className="absolute inset-0 bg-gradient-to-b from-black/65 via-black/75 to-black/85" />
          <div className="absolute inset-0 bg-gradient-to-br from-[#007A33]/25 via-transparent to-[#00A04A]/15" />

          <div className="relative p-7">
            <h1
              className="text-2xl font-bold text-white mb-1"
              style={{ textShadow: '0 2px 8px rgba(0,0,0,0.7)' }}
            >
              Create account
            </h1>
            <p
              className="text-sm text-white/80 mb-5"
              style={{ textShadow: '0 1px 4px rgba(0,0,0,0.7)' }}
            >
              Join Heineken and get a{' '}
              <span className="text-[#00A04A] font-bold">₦500 welcome bonus</span> instantly.
            </p>

            {error && (
              <div className="mb-4 px-4 py-3 rounded-xl bg-red-500/20 border border-red-400/40 text-sm text-red-100 backdrop-blur-sm">
                {error}
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-white/90 uppercase tracking-wide mb-1.5">
                  Full Name
                </label>
                <div className="relative">
                  <User size={18} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-white/70 z-10" />
                  <input
                    type="text"
                    required
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    placeholder="Chukwuma Okafor"
                    className="w-full bg-white/95 backdrop-blur-sm border border-white/40 rounded-xl pl-11 pr-4 py-3 text-sm text-[#0A2A1A] placeholder-[#8A9A90] outline-none focus:border-[#00A04A] focus:ring-2 focus:ring-[#00A04A]/30 transition-all"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-white/90 uppercase tracking-wide mb-1.5">
                  Phone Number
                </label>
                <div className="relative">
                  <Phone size={18} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-white/70 z-10" />
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
                  <Lock size={18} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-white/70 z-10" />
                  <input
                    type={showPassword ? 'text' : 'password'}
                    required
                    minLength={6}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="At least 6 characters"
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

              <div>
                <label className="block text-xs font-semibold text-white/90 uppercase tracking-wide mb-1.5">
                  Confirm Password
                </label>
                <div className="relative">
                  <Lock size={18} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-white/70 z-10" />
                  <input
                    type={showPassword ? 'text' : 'password'}
                    required
                    minLength={6}
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="Re-enter your password"
                    className="w-full bg-white/95 backdrop-blur-sm border border-white/40 rounded-xl pl-11 pr-11 py-3 text-sm text-[#0A2A1A] placeholder-[#8A9A90] outline-none focus:border-[#00A04A] focus:ring-2 focus:ring-[#00A04A]/30 transition-all"
                  />
                  {confirmPassword.length > 0 && (
                    <span className="absolute right-3.5 top-1/2 -translate-y-1/2 z-10">
                      {password === confirmPassword ? (
                        <CheckCircle2 size={18} className="text-[#00A04A]" />
                      ) : (
                        <span className="text-xs text-red-400 font-medium">mismatch</span>
                      )}
                    </span>
                  )}
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-white/90 uppercase tracking-wide mb-1.5">
                  Referral Code <span className="text-white/50 normal-case font-normal">(optional)</span>
                </label>
                <div className="relative">
                  <Gift size={18} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-white/70 z-10" />
                  <input
                    type="text"
                    value={referralCode}
                    onChange={(e) => setReferralCode(e.target.value.toUpperCase())}
                    placeholder="TVXXXXXX"
                    className="w-full bg-white/95 backdrop-blur-sm border border-white/40 rounded-xl pl-11 pr-4 py-3 text-sm text-[#0A2A1A] placeholder-[#8A9A90] outline-none focus:border-[#00A04A] focus:ring-2 focus:ring-[#00A04A]/30 transition-all"
                  />
                </div>
                {referralCode && (
                  <p
                    className="mt-1.5 text-xs text-[#00A04A] flex items-center gap-1 font-semibold"
                    style={{ textShadow: '0 1px 4px rgba(0,0,0,0.6)' }}
                  >
                    <CheckCircle2 size={12} /> Referral code applied
                  </p>
                )}
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full bg-gradient-to-r from-[#007A33] to-[#005A26] text-white font-bold py-3 rounded-xl hover:from-[#00A04A] hover:to-[#007A33] shadow-lg transition-all disabled:opacity-50"
              >
                {loading ? 'Creating account...' : 'Create Account'}
              </button>
            </form>

            <p
              className="text-center text-sm text-white/80 mt-5"
              style={{ textShadow: '0 1px 4px rgba(0,0,0,0.7)' }}
            >
              Already have an account?{' '}
              <Link to="/login" className="text-[#00A04A] font-semibold hover:text-[#00A04A]/80">
                Sign in
              </Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}