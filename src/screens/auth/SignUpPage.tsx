import { useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { Lock, Eye, EyeOff, User, Phone, Gift, CheckCircle2 } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { Logo } from '@/components/Logo';

const HERO_IMAGE = 'https://i.ibb.co/VcZZHLCy/Gemini-Generated-Image.jpg';

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

  // ============ SUCCESS SCREEN ============
  if (success) {
    return (
      <div className="min-h-screen flex flex-col bg-obsidian">
        <div className="flex-1 flex flex-col items-center justify-center px-6 max-w-md mx-auto w-full text-center">

          {/* Glass card with image background */}
          <div className="relative rounded-2xl overflow-hidden animate-slide-up border border-obsidian-border/60 w-full">
            {/* Image background */}
            <div
              className="absolute inset-0 bg-cover bg-center bg-no-repeat"
              style={{ backgroundImage: `url(${HERO_IMAGE})` }}
            />
            {/* Dark overlay */}
            <div className="absolute inset-0 bg-gradient-to-b from-obsidian/75 via-obsidian/85 to-obsidian/95" />
            {/* Warm tint */}
            <div className="absolute inset-0 bg-gradient-to-br from-gold/8 via-transparent to-emerald/5" />

            {/* Content */}
            <div className="relative p-8">
              <div className="w-20 h-20 rounded-full bg-emerald/15 border border-emerald/40 flex items-center justify-center mx-auto mb-5 animate-pulse-gold">
                <CheckCircle2 size={40} className="text-emerald" />
              </div>
              <h1 className="text-2xl font-bold text-white mb-2">Account created!</h1>
              <p className="text-slate-400 text-sm">
                Your TerraVault account is ready with a{' '}
                <span className="text-gold font-semibold">₦1,500 welcome bonus</span> credited
                to your wallet. Taking you to your dashboard...
              </p>
            </div>
          </div>

        </div>
      </div>
    );
  }

  // ============ SIGNUP FORM ============
  return (
    <div className="min-h-screen flex flex-col bg-obsidian">
      <div className="flex-1 flex flex-col justify-center px-6 pb-10 max-w-md mx-auto w-full pt-10">
        <div className="mb-6 flex justify-center animate-fade-in">
          <Logo size="lg" />
        </div>

        {/* Glass card with image background */}
        <div className="relative rounded-2xl overflow-hidden animate-slide-up border border-obsidian-border/60">
          {/* Image background */}
          <div
            className="absolute inset-0 bg-cover bg-center bg-no-repeat"
            style={{ backgroundImage: `url(${HERO_IMAGE})` }}
          />
          {/* Dark overlay for readability */}
          <div className="absolute inset-0 bg-gradient-to-b from-obsidian/75 via-obsidian/85 to-obsidian/95" />
          {/* Warm tint */}
          <div className="absolute inset-0 bg-gradient-to-br from-gold/8 via-transparent to-emerald/5" />

          {/* Card content */}
          <div className="relative p-7">
            <h1 className="text-2xl font-bold text-white mb-1">Create account</h1>
            <p className="text-sm text-slate-400 mb-5">
              Join TerraVault and get a{' '}
              <span className="text-gold font-semibold">₦1,500 welcome bonus</span> instantly.
            </p>

            {error && (
              <div className="mb-4 px-4 py-3 rounded-xl bg-red-500/10 border border-red-500/30 text-sm text-red-400">
                {error}
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="label-text">Full Name</label>
                <div className="relative">
                  <User size={18} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500" />
                  <input
                    type="text"
                    required
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    placeholder="Chukwuma Okafor"
                    className="input-field pl-11"
                  />
                </div>
              </div>

              <div>
                <label className="label-text">Phone Number</label>
                <div className="relative">
                  <Phone size={18} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500" />
                  <input
                    type="tel"
                    required
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="+234 803 000 0000"
                    className="input-field pl-11"
                  />
                </div>
              </div>

              <div>
                <label className="label-text">Password</label>
                <div className="relative">
                  <Lock size={18} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500" />
                  <input
                    type={showPassword ? 'text' : 'password'}
                    required
                    minLength={6}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="At least 6 characters"
                    className="input-field pl-11 pr-11"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((v) => !v)}
                    className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300"
                  >
                    {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                  </button>
                </div>
              </div>

              <div>
                <label className="label-text">Confirm Password</label>
                <div className="relative">
                  <Lock size={18} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500" />
                  <input
                    type={showPassword ? 'text' : 'password'}
                    required
                    minLength={6}
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="Re-enter your password"
                    className="input-field pl-11 pr-11"
                  />
                  {confirmPassword.length > 0 && (
                    <span className="absolute right-3.5 top-1/2 -translate-y-1/2">
                      {password === confirmPassword ? (
                        <CheckCircle2 size={18} className="text-emerald" />
                      ) : (
                        <span className="text-xs text-red-400 font-medium">mismatch</span>
                      )}
                    </span>
                  )}
                </div>
              </div>

              <div>
                <label className="label-text flex items-center gap-1.5">
                  Referral Code <span className="text-slate-600 font-normal">(optional)</span>
                </label>
                <div className="relative">
                  <Gift size={18} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500" />
                  <input
                    type="text"
                    value={referralCode}
                    onChange={(e) => setReferralCode(e.target.value.toUpperCase())}
                    placeholder="TVXXXXXX"
                    className="input-field pl-11"
                  />
                </div>
                {referralCode && (
                  <p className="mt-1.5 text-xs text-emerald flex items-center gap-1">
                    <CheckCircle2 size={12} /> Referral code applied
                  </p>
                )}
              </div>

              <button type="submit" disabled={loading} className="btn-gold w-full">
                {loading ? 'Creating account...' : 'Create Account'}
              </button>
            </form>

            <p className="text-center text-sm text-slate-400 mt-5">
              Already have an account?{' '}
              <Link to="/login" className="text-gold font-semibold hover:text-gold-light">
                Sign in
              </Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}