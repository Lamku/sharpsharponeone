export type NotificationType = 'info' | 'success' | 'warning' | 'error';

export interface NotificationTemplate {
  id: string;
  category: string;
  label: string;
  type: NotificationType;
  title: string;
  message: string;
}

export const NOTIFICATION_TEMPLATES: NotificationTemplate[] = [
  // ============ DEPOSITS ============
  {
    id: 'deposit_received',
    category: '💰 Deposit',
    label: 'Deposit Received',
    type: 'info',
    title: 'Deposit Received',
    message: "We received your deposit request. It's being processed and will reflect in your wallet within 5 minutes.",
  },
  {
    id: 'deposit_approved',
    category: '💰 Deposit',
    label: 'Deposit Approved',
    type: 'success',
    title: 'Deposit Approved ✅',
    message: 'Your deposit has been approved and added to your wallet. You can now invest in any plan.',
  },
  {
    id: 'deposit_rejected',
    category: '💰 Deposit',
    label: 'Deposit Rejected',
    type: 'error',
    title: 'Deposit Rejected',
    message: 'Your deposit request was rejected. Please contact support if you believe this is a mistake.',
  },

  // ============ WITHDRAWALS ============
  {
    id: 'withdrawal_approved',
    category: '🏦 Withdrawal',
    label: 'Withdrawal Approved',
    type: 'success',
    title: 'Withdrawal Approved ✅',
    message: 'Your withdrawal has been approved and is being processed. You will receive the funds within 5 minutes.',
  },
  {
    id: 'withdrawal_processed',
    category: '🏦 Withdrawal',
    label: 'Withdrawal Processed',
    type: 'success',
    title: 'Withdrawal Processed',
    message: 'Your withdrawal has been sent to your bank account. Thank you for using Sharpsharpone.',
  },
  {
    id: 'withdrawal_rejected',
    category: '🏦 Withdrawal',
    label: 'Withdrawal Rejected',
    type: 'error',
    title: 'Withdrawal Rejected',
    message: 'Your withdrawal request was rejected. The amount has been refunded to your wallet. Please verify your bank details and try again.',
  },
  {
    id: 'withdrawal_pending',
    category: '🏦 Withdrawal',
    label: 'Withdrawal Under Review',
    type: 'warning',
    title: 'Withdrawal Under Review',
    message: 'Your withdrawal request is being reviewed. We will notify you once it has been processed.',
  },

  // ============ GIFT CODES ============
  {
    id: 'gift_code_available',
    category: '🎁 Gift Code',
    label: 'Gift Code Available',
    type: 'success',
    title: '🎁 Gift Code Available!',
    message: 'A gift code has been generated for you. Go to the Redeem Gift tab NOW to claim it. It expires in 2 minutes!',
  },
  {
    id: 'gift_code_expiring',
    category: '🎁 Gift Code',
    label: 'Gift Code Expiring',
    type: 'warning',
    title: '⏰ Gift Code Expiring!',
    message: 'Your gift code is about to expire. Redeem it now in the Redeem Gift tab before it times out!',
  },
  {
    id: 'gift_code_redeemed',
    category: '🎁 Gift Code',
    label: 'Gift Redeemed',
    type: 'success',
    title: 'Gift Redeemed! 🎉',
    message: 'Your gift code was redeemed successfully. The amount has been credited to your wallet instantly.',
  },
  {
    id: 'gift_code_invalid',
    category: '🎁 Gift Code',
    label: 'Invalid Gift Code',
    type: 'error',
    title: 'Invalid Gift Code',
    message: 'The gift code you entered is not valid. Please check the code and try again.',
  },
  {
    id: 'gift_code_used',
    category: '🎁 Gift Code',
    label: 'Gift Code Already Used',
    type: 'error',
    title: 'Code Already Used',
    message: 'This gift code has already been redeemed. Each code can only be used once.',
  },
  {
    id: 'gift_friday_drop',
    category: '🎁 Gift Code',
    label: 'Friday Gift Drop',
    type: 'success',
    title: '🎁 Friday Gift Drop!',
    message: 'A gift code has been generated for you. Go to Redeem Gift section now. Expires in 2 minutes!',
  },
  {
    id: 'gift_weekly_drop',
    category: '🎁 Gift Code',
    label: 'Weekly Gift Drop',
    type: 'info',
    title: 'Weekly Gift Drop',
    message: 'Every Friday we drop gift codes on the platform. Stay active to catch one!',
  },

  // ============ INVESTMENTS ============
  {
    id: 'investment_activated',
    category: '📢 Investment',
    label: 'Investment Activated',
    type: 'success',
    title: 'Investment Active 🚀',
    message: 'Your investment is now active. You will start earning daily yields from tomorrow.',
  },
  {
    id: 'investment_yield_credited',
    category: '📢 Investment',
    label: 'Daily Yield Credited',
    type: 'success',
    title: 'Daily Yield Credited',
    message: 'Your daily yield has been credited to your wallet. Keep investing to grow your earnings!',
  },
  {
    id: 'investment_completed',
    category: '📢 Investment',
    label: 'Investment Completed',
    type: 'success',
    title: 'Investment Completed! 🎉',
    message: 'Congratulations! Your investment has completed. Total earnings have been credited to your wallet.',
  },
  {
    id: 'investment_reminder',
    category: '📢 Investment',
    label: 'Investment Reminder',
    type: 'info',
    title: 'Grow Your Wealth',
    message: 'Your wallet has funds available. Invest today to start earning daily returns. Check plans in the Invest tab.',
  },

  // ============ REFERRALS ============
  {
    id: 'referral_bonus',
    category: '👥 Referral',
    label: 'Referral Bonus Earned',
    type: 'success',
    title: 'Referral Bonus Earned 💰',
    message: 'Someone signed up using your referral code! A bonus has been credited to your wallet. Keep sharing to earn more.',
  },
  {
    id: 'referral_invite',
    category: '👥 Referral',
    label: 'Share & Earn',
    type: 'info',
    title: 'Share & Earn 💰',
    message: 'Share your referral code and earn a bonus for every friend who joins and invests.',
  },

  // ============ ACCOUNT ============
  {
    id: 'welcome',
    category: '⚠️ Account',
    label: 'Welcome to Sharpsharpone',
    type: 'success',
    title: 'Welcome to Sharpsharpone!',
    message: 'Your account is ready. You have a ₦1,500 welcome bonus in your wallet. Start investing today!',
  },
  {
    id: 'account_suspended',
    category: '⚠️ Account',
    label: 'Account Suspended',
    type: 'error',
    title: 'Account Suspended',
    message: 'Your account has been suspended due to suspicious activity. Contact support at support@sharpsharpone.app for assistance.',
  },
  {
    id: 'account_reactivated',
    category: '⚠️ Account',
    label: 'Account Reactivated',
    type: 'success',
    title: 'Account Reactivated',
    message: 'Your account has been reactivated. Welcome back to Sharpsharpone!',
  },
  {
    id: 'account_verification',
    category: '⚠️ Account',
    label: 'Verification Required',
    type: 'warning',
    title: 'Account Verification Required',
    message: 'Please verify your account to continue enjoying full access to Sharpsharpone features.',
  },
  {
    id: 'account_bank_update',
    category: '⚠️ Account',
    label: 'Update Bank Details',
    type: 'warning',
    title: 'Bank Details Issue',
    message: 'We noticed an issue with your bank account details. Please update them to avoid withdrawal delays.',
  },

  // ============ CHECK-IN ============
  {
    id: 'checkin_available',
    category: '📅 Check-In',
    label: 'Daily Check-In Available',
    type: 'info',
    title: 'Daily Bonus Ready!',
    message: 'Your ₦200 daily check-in bonus is available. Tap Check-In now before it resets at midnight!',
  },
  {
    id: 'checkin_streak',
    category: '📅 Check-In',
    label: 'Check-In Streak',
    type: 'success',
    title: 'Check-In Streak! 🔥',
    message: "You've checked in 7 days in a row! Keep it up to unlock special rewards.",
  },

  // ============ PROMOTIONAL ============
  {
    id: 'promo_new_plans',
    category: '🎉 Promotional',
    label: 'New Plans Available',
    type: 'info',
    title: 'New Investment Plans Available',
    message: 'We have added new investment plans with better returns. Check them out in the Invest tab now!',
  },
  {
    id: 'promo_limited_offer',
    category: '🎉 Promotional',
    label: 'Limited Time Offer',
    type: 'success',
    title: 'Limited Time Offer ⚡',
    message: 'Invest in any plan today and get a 5% bonus credited to your wallet within 24 hours. Do not miss out!',
  },
  {
    id: 'promo_last_chance',
    category: '🎉 Promotional',
    label: 'Last Chance',
    type: 'warning',
    title: 'Last Chance! ⏰',
    message: 'This offer ends in 24 hours. Invest now to lock in your daily returns.',
  },
  {
    id: 'promo_bonus_alert',
    category: '🎉 Promotional',
    label: 'Monthly Bonus Alert',
    type: 'success',
    title: 'Monthly Bonus Alert 🎊',
    message: 'Invest ₦10,000 or more this month and get a 5% cashback bonus credited instantly.',
  },

  // ============ FESTIVE ============
  {
    id: 'festive_christmas',
    category: '🎊 Festive',
    label: 'Merry Christmas',
    type: 'success',
    title: '🎄 Merry Christmas!',
    message: 'From all of us at Sharpsharpone, we wish you a Merry Christmas and a prosperous New Year. Enjoy a special ₦1,000 bonus on us!',
  },
  {
    id: 'festive_new_year',
    category: '🎊 Festive',
    label: 'Happy New Year',
    type: 'success',
    title: '🎉 Happy New Year!',
    message: 'Start the year with growth! Deposit and invest in any plan today and get a 10% bonus.',
  },
  {
    id: 'festive_ramadan',
    category: '🎊 Festive',
    label: 'Ramadan Kareem',
    type: 'info',
    title: 'Ramadan Kareem',
    message: 'Wishing you and your family a blessed Ramadan. Special investment plan available this month.',
  },
  {
    id: 'festive_eid',
    category: '🎊 Festive',
    label: 'Eid Mubarak',
    type: 'success',
    title: 'Eid Mubarak! 🌙',
    message: 'Wishing you and your loved ones a joyful Eid celebration. Special bonus awaiting you this week!',
  },
  {
    id: 'festive_independence',
    category: '🎊 Festive',
    label: 'Independence Day',
    type: 'success',
    title: '🇳🇬 Happy Independence Day!',
    message: 'Celebrating Nigeria with you! Enjoy a special gift code this Independence Day. Check the Redeem Gift tab.',
  },

  // ============ SUPPORT & UPDATES ============
  {
    id: 'update_system',
    category: '📞 Support',
    label: 'System Update',
    type: 'info',
    title: 'System Update',
    message: 'Sharpsharpone has been updated with new features. Refresh your app to see them!',
  },
  {
    id: 'update_maintenance',
    category: '📞 Support',
    label: 'Scheduled Maintenance',
    type: 'warning',
    title: 'Scheduled Maintenance',
    message: 'We will be performing maintenance from 2 AM to 4 AM. Withdrawals may be delayed during this period.',
  },
  {
    id: 'support_contact',
    category: '📞 Support',
    label: 'Customer Support',
    type: 'info',
    title: 'Customer Support',
    message: 'Need help? Contact us at support@sharpsharpone.app or call 08012345678. We are here 24/7.',
  },

  // ============ MOTIVATIONAL ============
  {
    id: 'motiv_weekly',
    category: '💡 Motivation',
    label: 'Weekly Investment Tip',
    type: 'info',
    title: 'Weekly Investment Tip 💡',
    message: 'Start your week strong! Invest in any plan today and earn daily returns. Check available plans in the Invest tab.',
  },
  {
    id: 'motiv_growing',
    category: '💡 Motivation',
    label: 'Portfolio Growing',
    type: 'info',
    title: 'Your Portfolio is Growing 📈',
    message: 'Every day you invest is a step toward financial freedom. Keep going!',
  },
  {
    id: 'motiv_growth',
    category: '💡 Motivation',
    label: 'Wealth Building',
    type: 'info',
    title: 'Build Wealth Daily',
    message: 'Small consistent investments lead to big results. Your daily earnings are proof of that!',
  },
];

// Group templates by category for easy display
export function getTemplatesByCategory(): Record<string, NotificationTemplate[]> {
  const grouped: Record<string, NotificationTemplate[]> = {};
  for (const template of NOTIFICATION_TEMPLATES) {
    if (!grouped[template.category]) {
      grouped[template.category] = [];
    }
    grouped[template.category].push(template);
  }
  return grouped;
}