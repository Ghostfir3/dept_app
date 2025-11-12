// قوالب الإشعارات المؤثرة والمحفزة

export const NotificationTemplates = {
  // إشعار دين جديد للعميل
  newDebtForCustomer: (merchantName: string, amount: number, description?: string) => ({
    title: "💰 دين جديد",
    message: `تم إضافة دين جديد من ${merchantName} بمبلغ ${amount} ر.س ${description ? `لهذا السبب: ${description}` : ''}`,
    style: "default" as const,
    category: "debt" as const
  }),

  // إشعار تأكيد الدين للعميل
  debtConfirmed: (merchantName: string, amount: number) => ({
    title: "✅ تم التأكيد",
    message: `تم تأكيد دين بمبلغ ${amount} ر.س من ${merchantName}. نقدر في أمانتك ونتطلع لاستيفائه.`,
    style: "emotional" as const,
    category: "debt" as const
  }),

  // إشعار اعتراض الدين للعميل
  debtDisputed: (merchantName: string, amount: number) => ({
    title: "❌ اعتراض",
    message: `تم الاعتراض على دين بمبلغ ${amount} ر.س من ${merchantName}. سيتم مراجعة الحالة قريباً.`,
    style: "urgent" as const,
    category: "debt" as const
  }),

  // إشعار سداد جزئي للعميل
  partialPayment: (merchantName: string, paidAmount: number, remainingAmount: number) => ({
    title: "💳 سداد جزئي",
    message: `تم استلام مبلغ ${paidAmount} ر.س من ${merchantName}. المبلغ المتبقي: ${remainingAmount} ر.س. شكراً لتعاونك!`,
    style: "friendly" as const,
    category: "payment" as const
  }),

  // إشعار الشكر والثقة عند السداد الكامل
  paymentThanks: (merchantName: string, amount: number, isFirstPayment: boolean = false) => ({
    title: "🙏 بارك الله فيك",
    message: isFirstPayment 
      ? `تم استلام المبلغ كاملاً ${amount} ر.س من ${merchantName}! 🎉 نقدر جداً تقيك ووفائك. أنت من النوع الذي نثق به! بارك الله فيك وادخلك في كل خير.`
      : `تم استلام المبلغ كاملاً ${amount} ر.س من ${merchantName}! 🤝 مرة أخرى تثبت أنك شخص مضمون ووفي. نقدر معاملتك ونثق بك دائماً. وفقك الله!`,
    style: "emotional" as const,
    category: "thanks" as const
  }),

  // إشعار تأخر للعميل (10 أيام)
  firstDelayWarning: (merchantName: string, amount: number, daysOverdue: number) => ({
    title: "⚠️ تذكير مهم",
    message: `مر ${daysOverdue} يوم على التأخر في سداد ${amount} ر.س من ${merchantName}. نقدر معرفتك بقدرتك الوجدانية ونعلم أنك إنسان مخلص، لكنكبدأت تفقد ثقتنا. تأكد من أن هذا الدين مهم عندنا ويسجل في ملفك الائتماني. نرجو منك السداد لتجديد الثقة.`,
    style: "emotional" as const,
    category: "delay" as const
  }),

  // إشعار تأخر شديد للعميل (20+ يوم)
  severeDelayWarning: (merchantName: string, amount: number, daysOverdue: number) => ({
    title: "🚨 تحذير خطير",
    message: `تحذير مهم! مر ${daysOverdue} يوماً على التأخر في سداد ${amount} ر.س من ${merchantName}. للأسف، مدى التزامك ضعيف في آخر 20 يوماً وهذا يؤثر على سجلك الائتماني. بعد 10 أيام أخرى، ستبقى في برنامج المتعثرين مما يؤثر على تعاملاتك المستقبلية. نرجو إما السداد أو التواصل مع التاجر لمعادلة الدين.`,
    style: "urgent" as const,
    category: "delay" as const
  }),

  // إشعار تذكير للتاجر (10 أيام)
  firstMerchantReminder: (customerName: string, amount: number, daysOverdue: number) => ({
    title: "⏰ تذكير ودود",
    message: `مر ${daysOverdue} يوم على موعد سداد دين ${amount} ر.س من ${customerName}. العميل بداية جيدة ولا يزال لديه فرصته. نرجو تذكيره بلطف أو التواصل معه.`,
    style: "friendly" as const,
    category: "reminder" as const
  }),

  // إشعار تذكير للتاجر (20+ يوم)
  secondMerchantReminder: (customerName: string, amount: number, daysOverdue: number) => ({
    title: "📋 متابعة",
    message: `مر ${daysOverdue} يوم على موعد سداد دين ${amount} ر.س من ${customerName}. العميل لم يستجب للتذكير الأول. نرجو الاتصال به أو النظر في اتخاذ إجراءات.`,
    style: "professional" as const,
    category: "reminder" as const
  }),

  // إشعار تذكير للتاجر (30+ يوم)
  thirdMerchantReminder: (customerName: string, amount: number, daysOverdue: number) => ({
    title: "⚠️ تحذير",
    message: `مر ${daysOverdue} يوم على موعد سداد دين ${amount} ر.س من ${customerName}. العميل معسر ولديه معوقات في السداد. نرجو النظر في كتابة الديون كمشفوعة أو أخذ ضمانات في المستقبل.`,
    style: "urgent" as const,
    category: "reminder" as const
  }),

  // إشعار دين متأخر للعميل
  debtOverdue: (merchantName: string, amount: number, daysOverdue: number) => ({
    title: "🚨 دين متأخر",
    message: `مر ${daysOverdue} يوم على موعد سداد دين ${amount} ر.س من ${merchantName}. الدين مدرج الآن في قائمة الديون المتأخرة. هذا يؤثر على علاقتك بالتاجر. نرجو التفاعل.`,
    style: "urgent" as const,
    category: "overdue" as const
  }),

  // إشعار تهنئة العميل للتاجر
  settlementComplete: (customerName: string, amount: number) => ({
    title: "🎉 تم التسوية",
    message: `تم استلام المبلغ كاملاً ${amount} ر.س من ${customerName}! العميل من النوع المضمون والموثوق.`,
    style: "friendly" as const,
    category: "settlement" as const
  })
};

// تصنيفات الإشعارات
export const NotificationCategories = {
  debt: 'دين',
  payment: 'سداد',
  delay: 'تأخر',
  thanks: 'شكر',
  reminder: 'تذكير',
  overdue: 'متأخر',
  settlement: 'تسوية',
  system: 'نظام'
};

// أنماط الإشعارات
export const NotificationStyles = {
  default: 'عادي',
  emotional: 'عاطفي',
  urgent: 'عاجل',
  friendly: 'ودود',
  professional: 'احترافي'
};

// دالة مساعدة لاختيار النص المناسب حسب أيام التأخر
export function getDelayTemplate(merchantName: string, customerName: string, amount: number, daysOverdue: number, isForCustomer: boolean) {
  if (isForCustomer) {
    if (daysOverdue <= 10) {
      return NotificationTemplates.firstDelayWarning(merchantName, amount, daysOverdue);
    } else if (daysOverdue <= 20) {
      return NotificationTemplates.severeDelayWarning(merchantName, amount, daysOverdue);
    } else {
      return NotificationTemplates.debtOverdue(merchantName, amount, daysOverdue);
    }
  } else {
    if (daysOverdue <= 10) {
      return NotificationTemplates.firstMerchantReminder(customerName, amount, daysOverdue);
    } else if (daysOverdue <= 20) {
      return NotificationTemplates.secondMerchantReminder(customerName, amount, daysOverdue);
    } else {
      return NotificationTemplates.thirdMerchantReminder(customerName, amount, daysOverdue);
    }
  }
}