import { useEffect, useState } from 'react';
import { Bell, X, Info, CheckCircle2, AlertTriangle, XCircle } from 'lucide-react';
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

export function NotificationBanner() {
  const { profile } = useAuth();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [dismissed, setDismissed] = useState<string[]>([]);

  useEffect(() => {
    if (!profile) return;

    // No orderBy — we sort in JavaScript
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

        // Sort newest first
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

  const typeStyles: Record<string, { bg: string; border: string; text: string; icon: any }> = {
    info: { bg: 'bg-sky-500/10', border: 'border-sky-500/30', text: 'text-sky-400', icon: Info },
    success: { bg: 'bg-emerald/10', border: 'border-emerald/30', text: 'text-emerald', icon: CheckCircle2 },
    warning: { bg: 'bg-amber-500/10', border: 'border-amber-500/30', text: 'text-amber-400', icon: AlertTriangle },
    error: { bg: 'bg-red-500/10', border: 'border-red-500/30', text: 'text-red-400', icon: XCircle },
  };

  return (
    <div className="space-y-2 mb-4">
      {visible.map((n) => {
        const style = typeStyles[n.type] || typeStyles.info;
        const Icon = style.icon;
        return (
          <div
            key={n.id}
            className={`${style.bg} ${style.border} border rounded-xl p-3 flex items-start gap-3 animate-slide-up`}
          >
            <div className={`w-8 h-8 rounded-lg ${style.bg} flex items-center justify-center flex-shrink-0`}>
              <Icon size={16} className={style.text} />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-white">{n.title}</p>
              <p className="text-xs text-slate-400 mt-0.5">{n.message}</p>
            </div>
            <button
              onClick={() => handleDismiss(n.id)}
              className="w-6 h-6 rounded-lg bg-slate-800/50 flex items-center justify-center text-slate-400 hover:text-white flex-shrink-0"
            >
              <X size={12} />
            </button>
          </div>
        );
      })}
    </div>
  );
}