"use client";
import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";

export type Lang = "en" | "ar";

// ─── Translations ──────────────────────────────────────────────────────────────
const translations: Record<Lang, Record<string, string>> = {
  en: {
    // Nav / common
    signIn: "Sign In",
    signOut: "Sign Out",
    backHome: "Back to home",
    platformCapabilities: "Platform Capabilities",
    about: "About",
    dashboard: "Dashboard",
    newProcess: "New Project",

    // Landing — hero
    badge: "Hafeet Rail — Internal Platform",
    heroHeadline: "Process Excellence",
    heroPlatform: "Platform",
    heroDesc:
      "Upload your current process documentation, identify where time and effort are lost, then generate a revised SOP ready for immediate team adoption.",
    openPlatform: "Open Platform",
    learnMore: "Learn More",
    stat1Value: "3",
    stat1Label: "Workflow Phases",
    stat2Label: "Powered Analysis",
    stat3Label: "Ready Output",

    // Landing — features
    featuresEyebrow: "Platform Capabilities",
    featuresHeading:
      "One workspace for analysis, redesign, and SOP delivery",
    featuresSub:
      "Start with the current process document and finish with a clear, updated operating procedure.",
    feature1Title: "Process Diagnosis",
    feature1Desc:
      "Upload a PDF or text process document. The platform maps every step, flags delays and bottlenecks, and gives you a structured baseline ready for review.",
    feature2Title: "Smart Optimisation",
    feature2Desc:
      "Select quick wins or define custom improvement criteria. The platform generates a revised process flow and quantifies the expected impact before rollout.",
    feature3Title: "SOP Generation",
    feature3Desc:
      "Produce a clean, bilingual SOP draft from approved changes — ready for management review, download, and handover to the owning team.",

    // Landing — about
    aboutEyebrow: "About",
    aboutHeading: "Built for Hafeet Rail Operations",
    aboutBody:
      "This platform enables Hafeet Rail teams to review service processes, surface operational bottlenecks, and apply evidence-based improvements. Move from document upload to a publishable, executive-ready SOP in a single integrated workflow.",

    // Footer
    copyright:
      "© {year} Hafeet Rail. All rights reserved.",

    // Login
    loginTitle: "Process Excellence Platform",
    loginDeptLine: "Hafeet Rail",
    emailLabel: "Email Address",
    passwordLabel: "Password",
    emailPlaceholder: "you@hafeetrail.ae",
    passwordPlaceholder: "••••••••",
    signingIn: "Signing in…",

    // Dashboard
    myProcesses: "My Projects",
    myProcessesSub:
      "All your project analysis & optimisation runs, isolated to your account.",
    searchPlaceholder: "Search projects…",
    openProcess: "Open Project",
    noMatchSearch: "No projects match your search.",
    noProcessesTitle: "No projects yet",
    noProcessesBody:
      'Click "New Project" to upload and analyse your first project document.',
    statusSopReady: "SOP Ready",
    statusOptimised: "Optimised",
    statusDiagnosed: "Diagnosed",
    statusEmpty: "Empty",
    confirmDelete: "Delete this project? This cannot be undone.",
    failedDelete: "Failed to delete project.",
    processesLabel: "processes",

    // Process Optimizer — create form
    createNewProcess: "Create New Project",
    createNewProcessSub: "Give your project a name to get started",
    processNameLabel: "Project Name",
    processNamePlaceholder: "e.g. Vendor Onboarding, License Renewal…",
    createProcess: "Create Project",
    creating: "Creating…",

    // Process Optimizer — upload panel
    uploadDocuments: "Upload Documents",
    dragDrop: "Drag & drop or click",
    fileHint: "PDF or TXT | multiple files | max 10 MB each",
    pending: "Pending",
    clearAll: "Clear all",
    runDiagnosis: "Run Diagnosis",
    reDiagnosis: "Re-run Diagnosis",
    diagnosedLabel: "Diagnosed",
    uploadedLabel: "Uploaded",

    // Process Optimizer — phase nav
    phase1: "Diagnose",
    phase2: "Optimize",
    phase3: "Generate SOP",

    // Process Optimizer — actions
    applyOptimizations: "Apply Optimizations",
    optimizing: "Optimizing…",
    generateSop: "Generate Updated SOP",
    generatingSop: "Generating SOP…",
    guided: "Guided",
    custom: "Custom",
    back: "← Back",
    copy: "Copy",
    download: "Download",

    // Process Optimizer — headings
    diagnosisReport: "Process Diagnosis Report",
    optimizationResults: "Optimization Results",
    updatedSop: "Updated SOP Document",

    // Process Optimizer — save status
    saving: "Saving…",
    saved: "Saved",
    saveFailed: "Save failed",

    // Process Optimizer — sidebar
    processesCount: "Processes",
    selectAll: "Select All",
    deselectAll: "Deselect All",
    run: "Run",

    // Process Optimizer — empty/loading states
    uploadFirst: "Create or open a project before uploading files.",
    uploadAndDiagnose: "Upload documents and run diagnosis to get started",
    useLeftPanel: "Use the panel on the left to upload files",
    useRightPanel: "Use the panel on the right to upload files",
    diagnosingDocs: "Diagnosing documents…",
    aiExtracting: "AI is extracting and diagnosing all processes",
    diagnosing: "Diagnosing…",
    reDiagnosing: "Re-diagnosing…",
    loadingProcess: "Loading process…",
    applyingOpts: "Applying optimizations…",
  },

  ar: {
    // Nav / common
    signIn: "تسجيل الدخول",
    signOut: "تسجيل الخروج",
    backHome: "العودة إلى الصفحة الرئيسية",
    platformCapabilities: "إمكانيات المنصة",
    about: "حول المنصة",
    dashboard: "لوحة التحكم",
    newProcess: "عملية جديدة",

    // Landing — hero
    badge: "حفيت للسكك الحديدية — منصة داخلية",
    heroHeadline: "التميز التشغيلي",
    heroPlatform: "المنصة",
    heroDesc:
      "ارفع وثائق العمليات الحالية، وحدد أين يُهدَر الوقت والجهد، ثم أنشئ إجراء تشغيل معدَّلاً جاهزاً لاعتماد الفريق فوراً.",
    openPlatform: "فتح المنصة",
    learnMore: "اعرف المزيد",
    stat1Value: "٣",
    stat1Label: "مراحل العمل",
    stat2Label: "تحليل بالذكاء الاصطناعي",
    stat3Label: "مخرجات جاهزة",

    // Landing — features
    featuresEyebrow: "إمكانيات المنصة",
    featuresHeading:
      "مساحة عمل واحدة للتحليل وإعادة التصميم وتسليم الإجراءات",
    featuresSub:
      "ابدأ بوثيقة العملية الحالية وانتهِ بإجراء تشغيل واضح ومحدَّث.",
    feature1Title: "تشخيص العمليات",
    feature1Desc:
      "ارفع ملف PDF أو نصياً للعملية. تُحدد المنصة كل خطوة وتضع علامة على التأخيرات ونقاط الاختناق وتمنحك خطاً أساسياً منظماً جاهزاً للمراجعة.",
    feature2Title: "التحسين الذكي",
    feature2Desc:
      "اختر المكاسب السريعة أو حدد معايير تحسين مخصصة. تُنشئ المنصة تدفقاً معدَّلاً للعملية وتقيس الأثر المتوقع قبل التنفيذ.",
    feature3Title: "إنشاء إجراءات التشغيل",
    feature3Desc:
      "أنتج مسودة إجراء تشغيل ثنائية اللغة من التغييرات المعتمدة — جاهزة لمراجعة الإدارة والتنزيل والتسليم للفريق المختص.",

    // Landing — about
    aboutEyebrow: "حول المنصة",
    aboutHeading: "مُصمَّمة لعمليات حفيت للسكك الحديدية",
    aboutBody:
      "تُمكِّن هذه المنصة فرق حفيت للسكك الحديدية من مراجعة عمليات الخدمة وكشف الاختناقات التشغيلية وتطبيق التحسينات المبنية على الأدلة. انتقل من رفع الوثيقة إلى إجراء تشغيل جاهز للتنفيذ في سير عمل متكامل واحد.",

    // Footer
    copyright:
      "© {year} حفيت للسكك الحديدية. جميع الحقوق محفوظة.",

    // Login
    loginTitle: "منصة التميز التشغيلي",
    loginDeptLine: "حفيت للسكك الحديدية",
    emailLabel: "البريد الإلكتروني",
    passwordLabel: "كلمة المرور",
    emailPlaceholder: "you@hafeetrail.ae",
    passwordPlaceholder: "••••••••",
    signingIn: "جارٍ تسجيل الدخول…",

    // Dashboard
    myProcesses: "عملياتي",
    myProcessesSub:
      "جميع تحليلات العمليات وجلسات التحسين الخاصة بحسابك.",
    searchPlaceholder: "ابحث في العمليات…",
    openProcess: "فتح العملية",
    noMatchSearch: "لا توجد عمليات تطابق بحثك.",
    noProcessesTitle: "لا توجد عمليات بعد",
    noProcessesBody:
      "انقر على «عملية جديدة» لرفع وتحليل أول وثيقة عملية.",
    statusSopReady: "الإجراء جاهز",
    statusOptimised: "محسَّن",
    statusDiagnosed: "تم التشخيص",
    statusEmpty: "فارغ",
    confirmDelete: "هل تريد حذف هذه العملية؟ لا يمكن التراجع.",
    failedDelete: "فشل حذف العملية.",
    processesLabel: "عمليات",

    // Process Optimizer — create form
    createNewProcess: "إنشاء عملية جديدة",
    createNewProcessSub: "أعطِ عمليتك اسماً للبدء",
    processNameLabel: "اسم العملية",
    processNamePlaceholder: "مثال: إعداد الموردين، تجديد الترخيص…",
    createProcess: "إنشاء العملية",
    creating: "جارٍ الإنشاء…",

    // Process Optimizer — upload panel
    uploadDocuments: "رفع الوثائق",
    dragDrop: "اسحب وأفلت أو انقر",
    fileHint: "PDF أو TXT | ملفات متعددة | الحد الأقصى ١٠ ميجابايت لكل ملف",
    pending: "في الانتظار",
    clearAll: "مسح الكل",
    runDiagnosis: "تشغيل التشخيص",
    reDiagnosis: "إعادة التشخيص",
    diagnosedLabel: "تم التشخيص",
    uploadedLabel: "تم الرفع",

    // Process Optimizer — phase nav
    phase1: "التشخيص",
    phase2: "التحسين",
    phase3: "إنشاء الإجراء",

    // Process Optimizer — actions
    applyOptimizations: "تطبيق التحسينات",
    optimizing: "جارٍ التحسين…",
    generateSop: "إنشاء الإجراء المحدَّث",
    generatingSop: "جارٍ إنشاء الإجراء…",
    guided: "موجَّه",
    custom: "مخصص",
    back: "رجوع →",
    copy: "نسخ",
    download: "تنزيل",

    // Process Optimizer — headings
    diagnosisReport: "تقرير تشخيص العملية",
    optimizationResults: "نتائج التحسين",
    updatedSop: "وثيقة الإجراء المحدَّثة",

    // Process Optimizer — save status
    saving: "جارٍ الحفظ…",
    saved: "تم الحفظ",
    saveFailed: "فشل الحفظ",

    // Process Optimizer — sidebar
    processesCount: "العمليات",
    selectAll: "تحديد الكل",
    deselectAll: "إلغاء التحديد",
    run: "تشغيل",

    // Process Optimizer — empty/loading states
    uploadFirst: "أنشئ مشروعاً أو افتح مشروعاً قبل رفع الملفات.",
    uploadAndDiagnose: "ارفع الوثائق وشغِّل التشخيص للبدء",
    useLeftPanel: "استخدم اللوحة الجانبية لرفع الملفات",
    useRightPanel: "استخدم اللوحة الجانبية لرفع الملفات",
    diagnosingDocs: "جارٍ تشخيص الوثائق…",
    aiExtracting: "الذكاء الاصطناعي يستخرج ويشخص جميع العمليات",
    diagnosing: "جارٍ التشخيص…",
    reDiagnosing: "جارٍ إعادة التشخيص…",
    loadingProcess: "جارٍ تحميل العملية…",
    applyingOpts: "جارٍ تطبيق التحسينات…",
  },
};

// ─── Context ───────────────────────────────────────────────────────────────────
interface LangContextValue {
  lang: Lang;
  setLang: (l: Lang) => void;
  t: (key: string, vars?: Record<string, string | number>) => string;
  isRTL: boolean;
}

const LangContext = createContext<LangContextValue>({
  lang: "en",
  setLang: () => undefined,
  t: (k) => k,
  isRTL: false,
});

function applyLangToDOM(l: Lang) {
  document.documentElement.dir = l === "ar" ? "rtl" : "ltr";
  document.documentElement.lang = l;
}

export function LanguageProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<Lang>("en");

  useEffect(() => {
    const stored = localStorage.getItem("hr-lang") as Lang | null;
    const initial: Lang = stored === "ar" ? "ar" : "en";
    setLangState(initial);
    applyLangToDOM(initial);
  }, []);

  const setLang = (l: Lang) => {
    setLangState(l);
    localStorage.setItem("hr-lang", l);
    applyLangToDOM(l);
  };

  const t = (key: string, vars?: Record<string, string | number>): string => {
    const dict = translations[lang];
    let str = dict[key] ?? translations.en[key] ?? key;
    if (vars) {
      Object.entries(vars).forEach(([k, v]) => {
        str = str.replace(`{${k}}`, String(v));
      });
    }
    return str;
  };

  return (
    <LangContext.Provider value={{ lang, setLang, t, isRTL: lang === "ar" }}>
      {children}
    </LangContext.Provider>
  );
}

export function useLanguage() {
  return useContext(LangContext);
}
