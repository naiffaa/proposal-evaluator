export type Language = 'en' | 'ar'

export const translations = {
  en: {
    common: {
      language: 'Language',
      english: 'English',
      arabic: 'العربية',
      view: 'View',
      back: 'Back',
      cancel: 'Cancel',
      save: 'Save',
      close: 'Close',
      continue: 'Continue',
      loading: 'Loading...',
      notAvailable: '—',
    },

    header: {
      brand: 'KSF Proposal Evaluation',
      portal: 'Portal',

      home: 'Home',
      newEvaluation: 'New Evaluation',
      evaluations: 'Evaluations',

      notifications: 'Notifications',

      profile: 'Profile',
      settings: 'Settings',
      helpSupport: 'Help & Support',
      signOut: 'Sign out',

      userName: 'Naifa Alarifi',
      userRole: 'Procurement Analyst',

      openNavigation: 'Open navigation',
      closeNavigation: 'Close navigation',
    },

    status: {
      draft: 'Draft',
      processing: 'Processing',
      completed: 'Completed',
      requiresReview: 'Requires Review',
    },

    recommendation: {
      recommendedForReview: 'Recommended for Review',
      noEligibleVendor: 'No Eligible Vendor',
      requiresHumanReview: 'Requires Human Review',
    },

    risk: {
      low: 'Low',
      medium: 'Medium',
      high: 'High',
    },

    match: {
      fullMatch: 'Full Match',
      partialMatch: 'Partial Match',
      noMatch: 'No Match',
      notProvided: 'Not Provided',
    },
  },

  ar: {
    common: {
      language: 'اللغة',
      english: 'English',
      arabic: 'العربية',
      view: 'عرض',
      back: 'رجوع',
      cancel: 'إلغاء',
      save: 'حفظ',
      close: 'إغلاق',
      continue: 'متابعة',
      loading: 'جارٍ التحميل...',
      notAvailable: '—',
    },

    header: {
      brand: 'تقييم العروض - KSF',
      portal: 'البوابة',

      home: 'الرئيسية',
      newEvaluation: 'إضافة منافسة',
      evaluations: 'سجل المنافسات',

      notifications: 'الإشعارات',

      profile: 'الملف الشخصي',
      settings: 'الإعدادات',
      helpSupport: 'المساعدة والدعم',
      signOut: 'تسجيل الخروج',

      userName: 'نايفة العريفي',
      userRole: 'محلل مشتريات',

      openNavigation: 'فتح قائمة التنقل',
      closeNavigation: 'إغلاق قائمة التنقل',
    },

    status: {
      draft: 'مسودة',
      processing: 'قيد المعالجة',
      completed: 'مكتمل',
      requiresReview: 'يتطلب مراجعة',
    },

    recommendation: {
      recommendedForReview: 'موصى به للمراجعة',
      noEligibleVendor: 'لا يوجد مورد مؤهل',
      requiresHumanReview: 'يتطلب مراجعة بشرية',
    },

    risk: {
      low: 'منخفض',
      medium: 'متوسط',
      high: 'مرتفع',
    },

    match: {
      fullMatch: 'مطابقة كاملة',
      partialMatch: 'مطابقة جزئية',
      noMatch: 'غير مطابق',
      notProvided: 'غير مقدم',
    },
  },
} as const

export type TranslationDictionary =
  typeof translations.en