import { useEffect, useState } from 'react';
import { X, Info, CheckCircle2, AlertTriangle, XCircle } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { db } from '@/lib/firebase';
import { collection, query, where, onSnapshot, updateDoc, doc } from 'firebase/firestore';

interface Notification {
  id: string;
  title: string;
  message: string;
  type: 'info' | 'success' | 'warning' | 'error';
  read: boolean;
  created_at: any;
}

// ============ HEINEKEN PALETTE PER TYPE ============
const TYPE_STYLES: Record<
  string,
  {
    bg: string;
    border: string;
    iconBg: string;
    iconColor: string;
    titleColor: string;
    msgColor: string;
    accent: string;
    Icon: any;
  }
> = {
  info: {
    bg: 'bg-[#007A33]/8',
    border: 'border-[#007A33]/25',
    iconBg: 'bg-[#007A33]/15',
    iconColor: 'text-[#007A33]',
    titleColor: 'text-[#0A2A1A]',
    msgColor: 'text-[#4A5A50]',
    accent: 'bg-[#007A33]',
    Icon: Info,
  },
  success: {
    bg: 'bg-[#00A04A]/10',
    border: 'border-[#00A04A]/30',
    iconBg: 'bg-[#00A04A]/15',
    iconColor: 'text-[#00A04A]',
    titleColor: 'text-[#0A2A1A]',
    msgColor: 'text-[#4A5A50]',
    accent: 'bg-[#00A04A]',
    Icon: CheckCircle2,
  },
  warning: {
    bg: 'bg-amber-400/10',
    border: 'border-amber-500/30',
    iconBg: 'bg-amber-500/15',
    iconColor: 'text-amber-600',
    titleColor: 'text-[#0A2A1A]',
    msgColor: 'text-[#4A5A50]',
    accent: 'bg-amber-500',
    Icon: AlertTriangle,
  },
  error: {
    bg: 'bg-red-500/8',
    border: 'border-red-500/30',
    iconBg: 'bg-red-500/12',
    iconColor: 'text-red-600',
    titleColor: 'text-[#0A2A1A]',
    msgColor: 'text-[#4A5A50]',
    accent: 'bg-red-500',
    Icon: XCircle,
  },
};

export function NotificationBanner() {
  const { profile } = useAuth();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [dismissed, setDismissed] = useState<string[]>([]);

  useEffect(() => {
    if (!profile) return;

    const q = query(
      collection(db, 'notifications'),
      where('user_id', '==', profile.id)
    );

    const unsubscribe = onSnapshot(
      q,
      (snap) => {
        const data = snap.docs
          .map(doc => ({ id: doc.id, ...doc.data() }))
          .filter((n: any) => !n.read) as Notification[];

        const sorted = data.sort((a, b) => {
          const aTime = a.created_at?.toDate?.()?.getTime() || 0;
          const bTime = b.created_at?.toDate?.()?.getTime() || 0;
          return bTime - aTime;
        });

        setNotifications(sorted);
      },
      (error) => {
        console.error('Error loading notifications:', error);
      }
    );

    return () => unsubscribe();
  }, [profile]);

  const handleDismiss = async (id: string) => {
    setDismissed(prev => [...prev, id]);
    try {
      await updateDoc(doc(db, 'notifications', id), { read: true });
    } catch (error) {
      console.error('Error marking notification as read:', error);
    }
  };

  const visible = notifications.filter(n => !dismissed.includes(n.id));
  if (visible.length === 0) return null;

  return (
    <div className="space-y-2 mb-4">
      {visible.map((n) => {
        const style = TYPE_STYLES[n.type] || TYPE_STYLES.info;
        const Icon = style.Icon;

        return (
          <div
            key={n.id}
            className={`relative ${style.bg} ${style.border} border rounded-2xl p-3.5 pl-4 flex items-start gap-3 animate-slide-up overflow-hidden`}
          >
            {/* Left accent bar */}
            <div className={`absolute left-0 top-0 bottom-0 w-1 ${style.accent}`} />

            {/* Icon */}
            <div
              className={`w-9 h-9 rounded-xl ${style.iconBg} flex items-center justify-center flex-shrink-0`}
            >
              <Icon size={17} className={style.iconColor} />
            </div>

            {/* Content — DARK text, fully readable */}
            <div className="flex-1 min-w-0">
              <p className={`text-sm font-bold ${style.titleColor} leading-tight`}>
                {n.title}
              </p>
              <p className={`text-xs ${style.msgColor} mt-1 leading-relaxed`}>
                {n.message}
              </p>
            </div>

            {/* Dismiss */}
            <button
              onClick={() => handleDismiss(n.id)}
              aria-label="Dismiss notification"
              className="w-7 h-7 rounded-lg bg-white border border-[#E8EDE8] flex items-center justify-center text-[#4A5A50] hover:text-[#007A33] hover:border-[#007A33]/40 transition-all flex-shrink-0"
            >
              <X size={13} />
            </button>
          </div>
        );
      })}
    </div>
  );
}