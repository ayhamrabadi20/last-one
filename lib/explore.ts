import type { ExplorationProfile } from "@/lib/explore-schema";
import type { ExploreResponse, ExplorationStep } from "@/lib/contracts";
import { sourceById } from "@/lib/knowledge";
import { businessGuide } from "@/lib/business-guides";

function includesAny(value: string, patterns: RegExp) {
  return patterns.test(value.toLowerCase());
}

export function fallbackExplorationProfile(goal: string): ExplorationProfile {
  const activityMatch = goal.match(/(?:محل|متجر|مطعم|مقهى|كافيه|شركة|شركه|مؤسسة|مؤسسه|مصنع|ورشة|ورشه|مكتب|صالون|مخبز|صيدلية|صيدليه|عيادة|عياده|تطبيق|منصة|منصه|كشك|مغسلة|مغسله|معرض|مستودع|حضانة|حضانه|مدرسة|مدرسه|نادي)(?:\s+[\p{L}-]+){0,2}/u);
  const locationMatch = goal.match(/(?:في\s+|ب)(خلدا|عمان|عمّان|اربد|إربد|الزرقاء|العقبة|مادبا|السلط|جرش|عجلون|الكرك)/u);
  const category = includesAny(goal, /حلويات|مطعم|مخبز|قهوة|مقهى|كافيه|طعام|غذاء|اغذية|أغذية|عصائر/)
    ? "food"
    : includesAny(goal, /برمجيات|تطبيق|منصة|الكتروني|إلكتروني|اونلاين|أونلاين/)
        ? "digital"
        : includesAny(goal, /مصنع|تصنيع|انتاج|إنتاج|ورشة/)
          ? "manufacturing"
          : includesAny(goal, /خدمة|صالون|مكتب|استشارات|توصيل|صيانة|مغسلة|مغسله|حضانة|حضانه|مدرسة|مدرسه|نادي/)
            ? "services"
            : includesAny(goal, /متجر|محل|بيع|تجزئة|ملابس|أحذية|الكترونيات|إلكترونيات/) ? "retail" : "other";

  const activityAr = activityMatch?.[0]
    .replace(/\s+(?:في|ب(?:خلدا|عمان|عمّان|اربد|إربد|الزرقاء|العقبة|مادبا|السلط|جرش|عجلون|الكرك)).*$/u, "")
    .trim();
  const physicalDescription = goal.replace(/متجر\s+(?:إلكتروني|الكتروني|أونلاين|اونلاين)/g, "");
  const hasPhysicalSite = /محل|متجر|مطعم|مقهى|كافيه|مكتب|مصنع|ورشة|ورشه|صالون|مخبز|صيدلية|صيدليه|عيادة|عياده|كشك|مغسلة|مغسله|معرض|مستودع|حضانة|حضانه|مدرسة|مدرسه|نادي/.test(physicalDescription);
  const hasOnlineModel = /اونلاين|أونلاين|الكتروني|إلكتروني|تطبيق|منصة|منصه/.test(goal) || category === "digital";

  const profile: ExplorationProfile = {
    activityAr: activityAr || goal.trim().slice(0, 120),
    locationAr: locationMatch?.[1] ?? null,
    category,
    businessModel: hasPhysicalSite && hasOnlineModel ? "mixed" : hasPhysicalSite ? "physical" : hasOnlineModel ? "online" : "unknown",
    premisesTenure: /مستأجر|مستاجر|ايجار|إيجار/.test(goal) ? "rent" : /مملوك|ملكي/.test(goal) ? "own" : "unknown",
  };
  const guide = businessGuide(goal, profile);
  return { ...profile, category: guide.category };
}

export function explorationProfileNeedsAI(profile: ExplorationProfile) {
  return profile.category === "other" && profile.businessModel === "unknown";
}

export function stabilizeExplorationProfile(goal: string, aiProfile: ExplorationProfile): ExplorationProfile {
  const deterministic = fallbackExplorationProfile(goal);
  const hasSpecificActivity = /^محل\s+\S+/u.test(deterministic.activityAr);
  return {
    activityAr: hasSpecificActivity ? deterministic.activityAr : aiProfile.activityAr,
    locationAr: deterministic.locationAr ?? aiProfile.locationAr,
    category: deterministic.category !== "other" ? deterministic.category : aiProfile.category,
    businessModel: deterministic.businessModel !== "unknown" ? deterministic.businessModel : aiProfile.businessModel,
    premisesTenure: deterministic.premisesTenure !== "unknown" ? deterministic.premisesTenure : aiProfile.premisesTenure,
  };
}

function step(
  id: string,
  titleAr: string,
  purposeAr: string,
  actions: string[],
  completionEvidence: string[],
  sourceIds: string[] = [],
): Omit<ExplorationStep, "order"> {
  return {
    id,
    titleAr,
    purposeAr,
    actions,
    completionEvidence,
    sourceIds,
    status: sourceIds.length ? "supported_by_pending_source" : "research_required",
  };
}

export function buildExplorationPlan(goal: string, profile: ExplorationProfile, aiMode: "ollama" | "fallback"): ExploreResponse {
  let guide = businessGuide(goal, profile);
  if (guide.id === "food" && /بيع\s+فقط|منتجات\s+جاهزة|بدون\s+(?:تصنيع|تحضير)|دون\s+(?:تصنيع|تحضير)/.test(goal)) {
    guide = {
      ...guide,
      summary: "بما أنك ستبيع منتجات جاهزة دون تحضير، ركّز على المورد والتخزين والعرض والتغليف وتتبع الصلاحية، بدل شراء معدات إنتاج لا تحتاجها.",
      equipment: ["تجهيز عرض وتبريد وتخزين يناسب المنتجات الجاهزة وفق تعليمات المورد والمختص.", "أرفف وتغليف ونظام تتبع للدفعات وتواريخ المنتجات؛ لا تفترض الحاجة لأفران أو خط تصنيع."],
      operations: ["استلم المنتجات بمطابقة المصدر والعدد والحالة وتاريخ الصلاحية.", "رتّب التخزين والعرض وفق تعليمات المنتج، وتابع الأصناف البطيئة والهدر.", "وثّق الطلب والتغليف والتسليم وراجع أي شكوى مرتبطة بمنتج أو دفعة."],
      costs: ["شراء المنتجات الجاهزة ونقلها", "العرض والتبريد والتغليف والهدر", "الإيجار والأجور والطاقة"],
    };
  }
  const location = profile.locationAr ?? "الموقع الذي ستختاره";
  const inAmman = /عمان|عمّان|خلدا/.test(location);
  const steps: Array<Omit<ExplorationStep, "order">> = [
    step(
      "define-scope",
      `ثبّت وصف ${profile.activityAr}`,
      "الوصف الدقيق يمنع تطبيق تصنيف أو متطلبات نشاط آخر على مشروعك.",
      [
        `اكتب ما الذي سيبيعه أو يقدمه ${profile.activityAr} بالضبط.` ,
        `ثبّت الموقع: ${location}، وحدد هل البيع من موقع فعلي أم إلكتروني أيضًا.`,
        "اختر الشكل القانوني المقصود وسجّل أي معلومة ما زالت غير محسومة كسؤال، لا كافتراض.",
      ],
      ["وصف نشاط من سطر واحد", "موقع محدد", "شكل قانوني مبدئي"],
    ),
    step(
      "test-demand", "افهم الزبون وحدد ما ستقدمه", "قبل شراء المعدات أو توقيع الإيجار، تأكد أن عرضك يناسب احتياجًا واضحًا في المنطقة أو القناة التي اخترتها.",
      [...guide.offerings, "قارن عروض منافسين قريبين: ماذا يقدمون، كيف يخدمون العميل، وما الفجوة التي تستطيع تحسينها؟", "تحدث مع عملاء محتملين وسجّل ما يطلبونه، بدل الاعتماد على توقعاتك وحدها."],
      ["شريحة عملاء محددة", "قائمة منتجات أو خدمات أولية", "ملاحظات من العملاء والمنافسين"],
    ),
    step(
      "verify-classification",
      "تحقق من التصنيف والتسجيل المناسبين",
      "اسم النشاط وتصنيفه الرسميان يحددان المسار اللاحق؛ لا يكفي الاسم الدارج للمشروع.",
      [
        "ابحث في الدليل الوطني لتصنيف الأنشطة الاقتصادية عن الوصف الأقرب، واحتفظ برقم/اسم التصنيف المقترح.",
        "راجع بوابة وزارة الصناعة والتجارة لمعرفة مسارات الأسماء التجارية والمؤسسات الفردية، ثم دوّن ما ينطبق بعد اختيار الشكل القانوني.",
        "لا تعتمد رسومًا أو وثائق حتى تجدها في بطاقة خدمة حديثة تخص التصنيف المختار.",
      ],
      ["تصنيف نشاط مرشح مع رابطه", "قرار موثق للشكل القانوني", "قائمة أسئلة للوزارة"],
      ["mit-individual-establishments"],
    ),
  ];

  if (profile.businessModel !== "online") {
    steps.push(step(
      "verify-premises",
      `تحقق من صلاحية الموقع في ${location}`,
      "وجود محل لا يعني تلقائيًا أن الموقع صالح للنشاط أو أن عقده يكفي للترخيص.",
      [
        "قبل الالتزام المالي، اسأل الجهة البلدية عن قابلية الموقع والتصنيف التنظيمي للنشاط المحدد.",
        profile.premisesTenure === "rent" ? "بما أن الموقع مستأجر، تحقق من صيغة إثبات الإشغال المطلوبة قبل توقيع العقد أو دفع التجهيز." : profile.premisesTenure === "own" ? "بما أن الموقع مملوك، تحقق من إثبات الملكية وصلاحية استعماله للنشاط المحدد." : "حدد هل الموقع مستأجر أم مملوك، واجمع إثبات الإشغال فقط بعد تأكيد الصيغة الحالية المطلوبة.",
        inAmman ? "ابدأ من بوابة أمانة عمّان وابحث عن نظام رخص المهن وبطاقة الخدمة الحديثة للنشاط." : "حدد البلدية المختصة وابحث عن بطاقة رخصة المهن الحديثة الخاصة بها.",
      ],
      ["إجابة مكتوبة أو بطاقة خدمة عن صلاحية الموقع", "رابط خدمة بلدية حديث", "قرار إيجار/ملكية"],
      inAmman ? ["gam-eservices-portal"] : [],
    ));
  }

  if (profile.category === "food") {
    steps.push(step(
      "verify-food-controls",
      "اكتشف اشتراطات الغذاء والصحة للنشاط المحدد",
      "بيع الغذاء الجاهز يختلف عن التحضير أو التصنيع داخل الموقع؛ حدد نموذجك حتى تبحث عن الاشتراطات المناسبة.",
      [
        "حدد هل يوجد تصنيع/تحضير داخل المحل أم بيع فقط، وهل توجد تعبئة أو توصيل.",
        "اطلب من البلدية تحديد الجهات القطاعية صاحبة الموافقة لهذا التصنيف، ثم افتح مصادرها الرسمية مباشرة.",
        "دوّن اشتراطات الموقع والتجهيز والسلامة من المصدر مع تاريخ الاطلاع وشروط انطباق كل بند.",
      ],
      ["نموذج التشغيل: تصنيع أم بيع", "قائمة الجهات التي حددتها البلدية", "مقاطع رسمية محفوظة لكل اشتراط"],
    ));
  } else if (profile.category === "manufacturing") {
    steps.push(step(
      "verify-sector-controls",
      "تحقق من موافقات التصنيع والبيئة والسلامة",
      "المسار الصناعي لا يجوز استنتاجه من مسار محل تجزئة.",
      ["حدد المواد والعمليات والطاقة والتخزين.", "اطلب من الجهة المحلية قائمة الموافقات القطاعية للتصنيف.", "اجمع بطاقات الخدمات الرسمية قبل تجهيز الموقع."],
      ["وصف عملية الإنتاج", "قائمة موافقات مرتبطة بالتصنيف", "روابط بطاقات خدمة حديثة"],
    ));
  }

  steps.push(
    step("prepare-equipment", `جهّز ${guide.label} حسب الخدمات المختارة`, "هذه اقتراحات تشغيلية لتساعدك في جمع عروض وتجربة الأدوات؛ ليست قائمة تجهيزات مفروضة للترخيص.",
      [...(profile.businessModel === "online" && guide.id !== "digital" ? ["جهّز عرض المنتجات وتصويرها، وطريقة استقبال الطلب والدفع والتغليف والتوصيل.", "حدد أين ستخزّن المنتجات ومن سيجهز الطلبات؛ لا تفترض الحاجة لمحل يستقبل الجمهور."] : guide.equipment), "اجمع عروضًا قابلة للمقارنة تشمل التركيب والضمان والصيانة، وافصل التجهيز الضروري عن الذي يمكن تأجيله."],
      ["مخطط توزيع العمل والتجهيزات", "عروض موردين بمواصفات متطابقة", "قائمة مشتريات على مراحل"]),
    step("plan-operations", "رتّب يوم العمل من الاستلام إلى التسليم", "وضوح خطوات الخدمة يرفع الجودة ويكشف الوقت والموارد التي يحتاجها كل طلب.",
      guide.operations, ["إجراء مكتوب لكل خدمة أساسية", "مسؤوليات واضحة للفريق", "طريقة متابعة الجودة والشكاوى"]),
    step("estimate-costs", "احسب التكاليف قبل تحديد الأسعار", "استخدم عروضًا وأسعارًا فعلية تخص موقعك وحجم العمل؛ لا يوجد هنا سعر افتتاح أو ربح مضمون.",
      [...guide.costs.map((cost) => `اجمع تكلفة فعلية لبند: ${cost}.`), "افصل تكاليف التأسيس مرة واحدة، والمصاريف الثابتة الشهرية، والتكلفة المتغيرة لكل طلب.", "هامش المساهمة للطلب = سعر البيع − تكلفته المتغيرة. عدد الطلبات لتغطية الثابت = المصاريف الثابتة ÷ هامش المساهمة، بشرط أن يكون الهامش موجبًا؛ أضف البنود الخاصة بحالتك مثل الرسوم والضرائب بعد التحقق منها.", "اختبر سيناريو طلب منخفض ومتوسط، واحسب المال اللازم لتشغيل المشروع قبل وصول الإيرادات."],
      ["جدول تأسيس وتشغيل بأسعار فعلية", "تكلفة وسعر مبدئي لكل منتج أو خدمة", "حساب تغطية المصاريف مع افتراضات واضحة"]),
    step("launch-and-measure", "ابدأ بنطاق صغير وقِس النتيجة", "جرّب طريقة التشغيل بعد استكمال ما ينطبق من موافقات، ثم حسّن العرض وفق النتائج بدل زيادة المصروف مباشرة.",
      ["اختبر طلبًا كاملًا وقِس الوقت والجودة والتكلفة قبل التوسع.", "اعرض خدماتك وأسعارك ووسيلة التواصل بوضوح في القناة المناسبة لعملائك.", "تابع عدد الطلبات ومتوسط قيمة الطلب والهدر أو إعادة العمل ورضا العملاء أسبوعيًا.", ...guide.risks.map((risk) => `انتبه: ${risk}`)],
      ["تجربة تشغيل موثقة", "قائمة أسعار ونطاق خدمة واضح", "سجل أسبوعي للطلبات والتكلفة وملاحظات العملاء"]),
  );

  steps.push(step(
    "build-verified-checklist",
    "حوّل البحث إلى قائمة تنفيذ موثقة",
    "لا تتحول نتائج البحث إلى متطلبات مشروع إلا بعد ربط كل بند بمصدر وشروط انطباقه.",
    [
      "أنشئ جدولًا: الإجراء، الجهة، الشرط، الوثيقة، المصدر، تاريخ المراجعة، وما إذا كان ينطبق على حالتك.",
      "رتب الإجراءات حسب الاعتماديات: ما الذي يجب حسمه قبل توقيع الإيجار، وما الذي يحتاج تسجيلًا أو موافقة سابقة.",
      "ضع الرسوم والمدد كـ«غير مؤكدة» حتى تتحقق منها مباشرة، ثم ابدأ التنفيذ من أول بند موثق.",
    ],
    ["قائمة تنفيذ بمصدر لكل بند", "أسئلة معلقة منفصلة", "أول خطوة موثقة قابلة للتنفيذ"],
  ));

  const ordered = steps.map((item, index) => ({ ...item, order: index + 1 }));
  const sourceIds = [...new Set(ordered.flatMap((item) => item.sourceIds))];
  const sources = sourceIds.map(sourceById).filter((item): item is NonNullable<typeof item> => Boolean(item));

  return {
    goal,
    profile,
    titleAr: `خطة مشروعك: ${profile.activityAr}`,
    overview: {
      sectorId: guide.id,
      sectorAr: guide.label,
      summaryAr: guide.summary,
      firstActionAr: `ابدأ بتحديد عرض ${profile.activityAr}: ${guide.offerings[0]}`,
      questions: [...guide.questions, ...(profile.locationAr ? [] : ["في أي مدينة أو منطقة سيكون المشروع؟"]), ...(profile.premisesTenure === "unknown" && profile.businessModel !== "online" ? ["هل لديك موقع أم تبحث عن محل للإيجار أو الملكية؟"] : [])],
      risks: guide.risks,
    },
    noticeAr: "هذه خطة بحث وتنفيذ أولية وليست قائمة متطلبات حكومية. أي شرط أو وثيقة أو رسم يبقى غير معتمد حتى ربطه بمصدر رسمي حديث ينطبق على نشاطك وموقعك.",
    steps: ordered,
    sources,
    aiMode,
  };
}
