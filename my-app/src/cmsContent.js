export const DEFAULT_CMS_CONTENT = {
  siteTitle: "Hinunangan Water",
  heroKicker: "Hinunangan Water Billing System",
  announcementsTitle: "Announcements",
  servicesHeading: "Tanang kinahanglan nimo sa tubig, usa ka lugar",
  servicesSubheading: "Dili na kinahanglan moadto sa opisina para sa kasagarang transaksyon.",
  paymentHeading: "Convenient ways to pay",
  paymentDescription: "Choose a digital wallet or bank for your water bill payment.",
  stepsHeading: "Pagbayad sa tulo ka lakang",
  footerTagline: "Mobile app coming soon",
  heroSlides: [
    {
      id: "payment",
      key: "payment",
      title: "Faster payment",
      text: "Bayri ang imong water bill sa pipila ka minuto. Walay taas nga pila, walay paghulat.",
      cta: "Pay my bill",
      active: true,
    },
    {
      id: "inquiry",
      key: "inquiry",
      title: "Inquiry",
      text: "Pangutana bahin sa bill, leak, o serbisyo. Makadawat ka og tubag nga klaro ug dali.",
      cta: "Send an inquiry",
      active: true,
    },
    {
      id: "application",
      key: "application",
      title: "Account application",
      text: "Mag-apply og bag-ong water connection online. I-submit ang requirements gikan sa balay.",
      cta: "Apply now",
      active: true,
    },
    {
      id: "more",
      key: "more",
      title: "And more",
      text: "Tan-awa ang imong consumption history, receipts, ug mga anunsyo sa serbisyo sa tubig.",
      cta: "See all services",
      active: true,
    },
  ],
  announcements: [
    {
      id: "water-interruption",
      title: "Water interruption",
      text: "Pahibalo sa schedule sa maintenance sa inyong barangay.",
      active: true,
    },
    {
      id: "meter-reading",
      title: "Meter reading",
      text: "Ang pagbasa sa metro mahitabo sa sinugdanan sa matag bulan.",
      active: true,
    },
    {
      id: "payment-reminder",
      title: "Payment reminder",
      text: "Bayri sa dili pa ang due date aron likayan ang penalty.",
      active: true,
    },
  ],
  services: [
    { id: "online-payment", title: "Online payment", text: "Bayad gamit ang imong account number. Naay receipt dayon.", active: true },
    { id: "bill-inquiry", title: "Bill inquiry", text: "Susiha ang imong current balance ug due date bisan asa.", active: true },
    { id: "new-connection", title: "New connection", text: "Pag-apply og bag-ong koneksyon ug sunda ang status sa imong application.", active: true },
    { id: "service-report", title: "Leak & service report", text: "I-report ang tulo, putol nga tubo, o walay tubig sa inyong lugar.", active: true },
    { id: "consumption-history", title: "Consumption history", text: "Tan-awa kung pila ka cubic meter ang nagamit kada bulan.", active: true },
    { id: "announcements", title: "Announcements", text: "Madawat ang schedule sa maintenance ug uban pang pahibalo.", active: true },
  ],
  paymentMethods: [
    ...["GCash", "Maya", "GoTyme Bank", "SeaBank", "ShopeePay", "GrabPay"].map((name, index) => ({
      id: `wallet-${index + 1}`,
      name,
      category: "wallet",
      active: true,
    })),
    ...[
      "BDO Unibank",
      "BPI (Bank of the Philippine Islands)",
      "Metrobank",
      "UnionBank of the Philippines",
      "RCBC (Rizal Commercial Banking Corporation)",
      "Security Bank",
      "Chinabank",
      "PNB (Philippine National Bank)",
      "Land Bank of the Philippines",
      "Bank of Commerce",
      "Asia United Bank (AUB)",
    ].map((name, index) => ({
      id: `bank-${index + 1}`,
      name,
      category: "bank",
      active: true,
    })),
  ],
  steps: [
    { id: "step-1", title: "Ibutang ang account number", text: "Makita kini sa imong water bill.", active: true },
    { id: "step-2", title: "Tan-awa ang bill", text: "Klaro ang amount, due date, ug consumption.", active: true },
    { id: "step-3", title: "Bayri ug kuhaa ang receipt", text: "Kompleto na, mahatagan ka og proof of payment.", active: true },
  ],
};

export function normalizeCmsContent(content) {
  if (!content || typeof content !== "object" || Array.isArray(content)) {
    return DEFAULT_CMS_CONTENT;
  }

  return {
    ...DEFAULT_CMS_CONTENT,
    ...content,
    heroSlides: Array.isArray(content.heroSlides) ? content.heroSlides : DEFAULT_CMS_CONTENT.heroSlides,
    announcements: Array.isArray(content.announcements) ? content.announcements : DEFAULT_CMS_CONTENT.announcements,
    services: Array.isArray(content.services) ? content.services : DEFAULT_CMS_CONTENT.services,
    paymentMethods: Array.isArray(content.paymentMethods) ? content.paymentMethods : DEFAULT_CMS_CONTENT.paymentMethods,
    steps: Array.isArray(content.steps) ? content.steps : DEFAULT_CMS_CONTENT.steps,
  };
}
