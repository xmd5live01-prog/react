import { useEffect, useRef, useState } from "react";
import heroImg from "./assets/hero.jpg";
import { DEFAULT_CMS_CONTENT, normalizeCmsContent } from "./cmsContent";
import "./LandingPage.css";

const SLIDES = [
  { key: "payment", title: "Faster payment", text: "Bayri ang imong water bill sa pipila ka minuto. Walay taas nga pila, walay paghulat.", cta: "Pay my bill",
    icon: (<><rect x="14" y="26" width="72" height="48" rx="8" /><path d="M14 42h72M26 60h18" /><circle cx="70" cy="60" r="5" /></>) },
  { key: "inquiry", title: "Inquiry", text: "Pangutana bahin sa bill, leak, o serbisyo. Makadawat ka og tubag nga klaro ug dali.", cta: "Send an inquiry",
    icon: (<><path d="M18 24h64a6 6 0 0 1 6 6v32a6 6 0 0 1-6 6H48L30 82V68H18a6 6 0 0 1-6-6V30a6 6 0 0 1 6-6z" /><path d="M34 42h32M34 54h20" /></>) },
  { key: "application", title: "Account application", text: "Mag-apply og bag-ong water connection online. I-submit ang requirements gikan sa balay.", cta: "Apply now",
    icon: (<><path d="M28 14h32l16 16v52a4 4 0 0 1-4 4H28a4 4 0 0 1-4-4V18a4 4 0 0 1 4-4z" /><path d="M60 14v18h16M36 52h28M36 64h28M36 76h16" /></>) },
  { key: "more", title: "And more", text: "Tan-awa ang imong consumption history, receipts, ug mga anunsyo sa serbisyo sa tubig.", cta: "See all services",
    icon: (<><rect x="16" y="16" width="30" height="30" rx="7" /><rect x="54" y="16" width="30" height="30" rx="7" /><rect x="16" y="54" width="30" height="30" rx="7" /><path d="M69 54v30M54 69h30" /></>) },
];

const SLIDE_ICONS = Object.fromEntries(SLIDES.map(({ key, icon }) => [key, icon]));
const PAYMENT_CATEGORIES = [
  { key: "wallet", title: "Pay with e-wallets", category: "Digital payments" },
  { key: "bank", title: "Pay with traditional banks", category: "Direct bank payments" },
];

const GooglePlayLogo = () => (
  <svg viewBox="0 0 512 512" width="28" height="28" aria-hidden="true">
    <path fill="#00d7fe" d="M48 22c-6 6-10 15-10 27v414c0 12 4 21 10 27l2 2 232-232v-6L50 20z" />
    <path fill="#00f076" d="M359 335l-77-77v-6l77-77 2 1 92 52c26 15 26 39 0 54l-92 52z" />
    <path fill="#ff3a44" d="M361 334L282 255 48 489c9 10 23 11 40 1l273-156" />
    <path fill="#ffd400" d="M361 176L88 21C71 11 57 12 48 22l234 233z" />
  </svg>
);

const AppleLogo = () => (
  <svg viewBox="0 0 384 512" width="24" height="28" aria-hidden="true" fill="#fff">
    <path d="M318.7 268.7c-.2-36.7 16.4-64.4 50-84.8-18.8-26.9-47.2-41.7-84.7-44.6-35.5-2.8-74.3 20.7-88.5 20.7-15 0-49.4-19.7-76.4-19.7C63.3 141.2 4 184.8 4 273.5q0 39.3 14.4 81.2c12.8 36.7 59 126.7 107.2 125.2 25.2-.6 43-17.9 75.8-17.9 31.8 0 48.3 17.9 76.4 17.9 48.6-.7 90.4-82.5 102.6-119.3-65.2-30.7-61.7-90-61.7-91.9zm-56.6-164.2c27.3-32.4 24.8-61.9 24-72.5-24.1 1.4-52 16.4-67.9 34.9-17.5 19.8-27.8 44.3-25.6 71.9 26.1 2 49.9-11.4 69.5-34.3z" />
  </svg>
);

const SearchIcon = () => (
  <svg className="h-[18px] w-[18px]" viewBox="0 0 24 24" fill="none" stroke="currentColor"
    strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <circle cx="10.8" cy="10.8" r="6.8" />
    <path d="m16 16 4.5 4.5" />
  </svg>
);

const StoreButton = ({ logo, small, name }) => (
  <button disabled aria-label={`${name}, coming soon`}
    className="flex items-center gap-2 sm:gap-2.5 bg-black text-white border border-white/35 rounded-[14px] px-2.5 sm:px-3.5 py-[7px] text-left cursor-not-allowed">
    {logo}
    <span className="flex flex-col leading-[1.15]">
      <small className="text-[.7rem] text-slate-300">{small}</small>
      <b className="text-[.95rem] sm:text-base font-bold">{name}</b>
    </span>
  </button>
);

export default function LandingPage({
  onSearchBill,
  content: contentInput = DEFAULT_CMS_CONTENT,
  preview = false,
  onExitPreview,
  contentError = "",
}) {
  const [i, setI] = useState(0);
  const [paymentSlide, setPaymentSlide] = useState(0);
  const [paymentSlidePaused, setPaymentSlidePaused] = useState(false);
  const touchX = useRef(0);
  const content = normalizeCmsContent(contentInput);
  const slides = content.heroSlides
    .filter((slide) => slide.active !== false)
    .map((slide) => ({ ...slide, icon: SLIDE_ICONS[slide.key] ?? SLIDE_ICONS.more }));
  const visibleSlides = slides.length ? slides : DEFAULT_CMS_CONTENT.heroSlides.map((slide) => ({
    ...slide,
    icon: SLIDE_ICONS[slide.key] ?? SLIDE_ICONS.more,
  }));
  const paymentSlides = PAYMENT_CATEGORIES.flatMap((group) => {
    const methods = content.paymentMethods.filter((method) => method.active !== false && method.category === group.key);
    const pageCount = Math.ceil(methods.length / 4);
    return Array.from({ length: pageCount }, (_, page) => ({
      ...group,
      title: `${group.title} · ${page + 1}/${pageCount}`,
      methods: methods.slice(page * 4, page * 4 + 4),
    }));
  });
  const visiblePaymentSlides = paymentSlides.length ? paymentSlides : [
    { title: "Payment methods", category: "Payment channels", methods: [] },
  ];
  const activeSlideIndex = i % visibleSlides.length;
  const activePaymentSlide = paymentSlide % visiblePaymentSlides.length;
  const announcements = content.announcements.filter((item) => item.active !== false);
  const services = content.services.filter((item) => item.active !== false);
  const steps = content.steps.filter((item) => item.active !== false);
  const go = (n) => setI((n + visibleSlides.length) % visibleSlides.length);

  useEffect(() => {
    if (visibleSlides.length < 2) return undefined;
    const id = setInterval(() => setI((n) => (n + 1) % visibleSlides.length), 4500);
    return () => clearInterval(id);
  }, [visibleSlides.length]);

  useEffect(() => {
    if (paymentSlidePaused || visiblePaymentSlides.length < 2) return undefined;
    const id = setInterval(() => {
      setPaymentSlide((n) => (n + 1) % visiblePaymentSlides.length);
    }, 7000);
    return () => clearInterval(id);
  }, [paymentSlidePaused, visiblePaymentSlides.length]);

  const h2 = "site-text font-display font-bold text-[clamp(1.9rem,4vw,2.9rem)] tracking-tight";
  const wrap = "mx-auto max-w-[1180px] px-[clamp(16px,5vw,48px)]";

  return (
    <div
      className="landing-site pb-0"
      data-template={content.landingTemplate}
      style={{
        "--site-primary": content.primaryColor,
        "--site-accent": content.accentColor,
        "--site-page": content.pageBackgroundColor,
        "--site-surface": content.surfaceColor,
        "--site-text": content.textColor,
        "--site-muted": content.mutedTextColor,
      }}
    >
      {/* NAV (scrolls with the page) */}
      <header className="landing-site-header absolute inset-x-0 top-0 z-20 flex items-center justify-between px-[clamp(16px,5vw,64px)] pt-[calc(16px+env(safe-area-inset-top,0px))] pb-4 text-white">
        <a href="#top" className="flex items-center gap-2.5 font-display text-[1.1rem] font-medium">
          {content.siteLogoImage ? (
            <img alt="" className="site-header-logo" src={content.siteLogoImage} />
          ) : (
            <svg viewBox="0 0 40 40" width="34" height="34" className="drop-shadow-[0_3px_5px_rgba(0,0,0,.4)]" aria-hidden="true">
              <path d="M20 3C12 14 6 21 6 27a14 14 0 0 0 28 0c0-6-6-13-14-24z" fill="var(--site-primary)" />
              <path d="M12 28c3-3 5-3 8 0s5 3 8 0" stroke="#fff" strokeWidth="2.2" fill="none" strokeLinecap="round" />
            </svg>
          )}
          <span>{content.siteTitle}</span>
        </a>
        <nav className="flex items-center gap-6 text-[.95rem] font-semibold">
          <a className="site-link hidden md:inline" href="#services">Services</a>
          <a className="site-link hidden md:inline" href="#how">How it works</a>
          <a className="site-link hidden md:inline" href="#app">Mobile app</a>
          <button type="button" onClick={onSearchBill} className="site-primary-bg inline-flex items-center gap-2 rounded-full px-[18px] py-[9px] font-bold text-white shadow-[0_8px_24px_rgba(8,102,255,.35)]">
            <SearchIcon />Search Bill
          </button>
        </nav>
      </header>

      {preview && (
        <div className="fixed inset-x-0 top-0 z-[60] flex items-center justify-between bg-[#13233e] px-4 py-2 text-sm font-semibold text-white shadow-lg">
          <span>Draft preview — changes are not published</span>
          <button className="rounded-md border border-white/40 px-3 py-1 hover:bg-white/10" onClick={onExitPreview} type="button">Exit preview</button>
        </div>
      )}
      {contentError && (
        <div className="fixed inset-x-0 bottom-24 z-[55] mx-auto w-fit max-w-[calc(100%-2rem)] rounded-xl bg-amber-100 px-4 py-3 text-sm text-amber-950 shadow-lg" role="status">
          {contentError}
        </div>
      )}

      {/* HERO SLIDESHOW */}
      <section id="top"
        className="hero-bg landing-hero-section relative flex min-h-svh flex-col justify-center overflow-hidden pb-[120px] text-white"
        onTouchStart={(e) => (touchX.current = e.touches[0].clientX)}
        onTouchEnd={(e) => {
          const dx = e.changedTouches[0].clientX - touchX.current;
          if (Math.abs(dx) > 50) go(activeSlideIndex + (dx < 0 ? 1 : -1));
        }}>
        <div className="hero-photo" style={{ backgroundImage: `url("${content.heroBackgroundImage || heroImg}")` }} aria-hidden="true" />

        <div className="pointer-events-none absolute inset-0" aria-hidden="true">
          {Array.from({ length: 10 }).map((_, n) => (
            <span key={n} className="absolute -bottom-8 animate-rise rounded-full bg-white/15"
              style={{ left: `${8 + n * 9}%`, animationDelay: `${n * 0.9}s`, width: 8 + (n % 4) * 6, height: 8 + (n % 4) * 6 }} />
          ))}
        </div>

        <div className="relative z-[5] mx-auto grid min-h-[520px] w-full max-w-[1180px] px-[clamp(16px,5vw,48px)] pb-5 pt-24 md:min-h-[430px] md:pt-[110px]">
          {visibleSlides.map((s, n) => (
            <article key={s.id} aria-hidden={n !== activeSlideIndex}
              className={`landing-hero-slide col-start-1 row-start-1 grid grid-cols-1 items-center gap-10 transition-all duration-700 ${content.landingTemplate === "elegant-water" ? "text-center md:grid-cols-1" : "md:grid-cols-[1.1fr_.9fr]"} ${n === activeSlideIndex ? "visible translate-x-0 opacity-100" : "invisible translate-x-10 opacity-0"}`}>
              <div>
                <p className="mb-3.5 font-semibold text-white/85">{content.heroKicker}</p>
                <h1 className="mb-5 font-display text-[clamp(2.6rem,7vw,5.2rem)] font-extrabold leading-none tracking-tight">{s.title}</h1>
                <p className="mb-8 max-w-[34em] text-[clamp(1.05rem,2vw,1.25rem)] leading-relaxed text-white/90">{s.text}</p>
                <div className="flex flex-wrap gap-3.5">
                  {s.key === "payment" ? (
                    <button type="button" onClick={onSearchBill} tabIndex={n === activeSlideIndex ? 0 : -1} className="site-primary-bg inline-flex items-center gap-2 rounded-full px-[26px] py-3.5 font-bold text-white shadow-[0_8px_24px_rgba(8,102,255,.35)] transition hover:-translate-y-0.5">
                      <SearchIcon />Search Bill
                    </button>
                  ) : (
                    <a href="#top" tabIndex={n === activeSlideIndex ? 0 : -1} className="site-primary-bg rounded-full px-[26px] py-3.5 font-bold text-white shadow-[0_8px_24px_rgba(8,102,255,.35)] transition hover:-translate-y-0.5">{s.cta}</a>
                  )}
                  <a href="#services" tabIndex={n === activeSlideIndex ? 0 : -1} className="rounded-full px-[26px] py-3.5 font-bold text-white shadow-[inset_0_0_0_2px_rgba(255,255,255,.55)]">Learn more</a>
                </div>
              </div>
              <div aria-hidden="true" className={`relative order-first grid aspect-square w-full max-w-[180px] place-items-center md:order-none md:max-w-[380px] ${content.landingTemplate === "elegant-water" ? "justify-self-center" : "justify-self-start md:justify-self-center"}`}>
                <div className="absolute inset-[6%] animate-ring rounded-full border-2 border-white/30" />
                <div className="absolute -inset-[4%] animate-ring rounded-full border-2 border-white/30 [animation-delay:1.3s]" />
                <svg viewBox="0 0 100 100" className="w-[62%] animate-float rounded-full bg-white/10 fill-white/10 stroke-white p-[18%]"
                  strokeWidth="3.2" strokeLinecap="round" strokeLinejoin="round">{s.icon}</svg>
              </div>
            </article>
          ))}
        </div>

        <div className="relative z-[5] mb-6 mt-2 flex items-center justify-center gap-[18px]">
          <button aria-label="Previous slide" onClick={() => go(activeSlideIndex - 1)} className="h-[42px] w-[42px] rounded-full border-2 border-white/50 text-2xl leading-none hover:bg-white/15">‹</button>
          <div className="flex gap-2.5">
            {visibleSlides.map((s, n) => (
              <button key={s.id} aria-label={`Go to ${s.title}`} onClick={() => go(n)}
                className={`h-3 rounded-full transition-all duration-300 ${n === activeSlideIndex ? "site-primary-bg w-9" : "w-3 bg-white/40"}`} />
            ))}
          </div>
          <button aria-label="Next slide" onClick={() => go(activeSlideIndex + 1)} className="h-[42px] w-[42px] rounded-full border-2 border-white/50 text-2xl leading-none hover:bg-white/15">›</button>
        </div>

        {/* Transparent announcements */}
        <div className={`${wrap} relative z-[5] w-full`}>
          <aside aria-label="Announcements" className="rounded-[22px] border border-white/30 bg-white/10 px-[22px] py-[18px] backdrop-blur-xl">
            <h2 className="mb-3 flex items-center gap-2 font-display text-[1.05rem] font-bold">
              <span className="site-primary-bg h-[9px] w-[9px] animate-ring rounded-full" />{content.announcementsTitle}
            </h2>
            <div className="grid grid-cols-[repeat(auto-fit,minmax(230px,1fr))] gap-x-[22px] gap-y-3">
              {announcements.map((item) => (
                <div key={item.id} className="site-primary-border border-l-[3px] pl-3">
                  <b className="block text-[.95rem]">{item.title}</b>
                  <span className="text-[.85rem] leading-snug text-white/90">{item.text}</span>
                </div>
              ))}
            </div>
          </aside>
        </div>

        <svg className="absolute -bottom-px left-0 h-[110px] w-full" viewBox="0 0 1440 120" preserveAspectRatio="none" aria-hidden="true">
          <path className="animate-drift fill-white/35" d="M0 60c120-40 240-40 360 0s240 40 360 0 240-40 360 0 240 40 360 0v60H0z" />
          <path className="site-page-fill" d="M0 80c120-30 240-30 360 0s240 30 360 0 240-30 360 0 240 30 360 0v40H0z" />
        </svg>
      </section>

      {/* SERVICES */}
      <section id="services" className="landing-reorderable landing-services-section site-page-bg py-20">
        <div className={wrap}>
          <h2 className={`${h2} mb-2.5`}>{content.servicesHeading}</h2>
          <p className="site-muted mb-10 text-[1.1rem]">{content.servicesSubheading}</p>
          <div className="grid grid-cols-[repeat(auto-fit,minmax(260px,1fr))] gap-5">
            {services.map((item) => (
              <div key={item.id} className="site-surface-bg site-card-border rounded-[22px_22px_22px_6px] border p-[26px] shadow-sm transition duration-300 hover:-translate-y-1 hover:shadow-xl motion-reduce:transform-none motion-reduce:transition-none">
                <span className="site-primary-bg block h-[26px] w-[26px] rotate-45 rounded-[0_50%_50%_50%]" />
                <h3 className="site-text mb-2 mt-3.5 font-display text-xl font-bold">{item.title}</h3>
                <p className="site-muted leading-relaxed">{item.text}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section
        aria-label="Payment methods"
        aria-roledescription="carousel"
        className="landing-reorderable landing-payment-section site-surface-bg py-16 sm:py-20"
        onBlur={(event) => {
          if (!event.currentTarget.contains(event.relatedTarget)) setPaymentSlidePaused(false);
        }}
        onFocusCapture={() => setPaymentSlidePaused(true)}
        onMouseEnter={() => setPaymentSlidePaused(true)}
        onMouseLeave={() => setPaymentSlidePaused(false)}
      >
        <div className={wrap}>
          <div className="mb-8 flex flex-wrap items-end justify-between gap-5 sm:mb-10">
            <div className="max-w-2xl">
              <p className="site-primary-text mb-2 text-xs font-bold uppercase tracking-[.16em]">Payment channels</p>
              <h2 className={`${h2} mb-2`}>{content.paymentHeading}</h2>
              <p className="site-muted m-0 text-base leading-relaxed">
                {content.paymentDescription}
              </p>
            </div>
            <div className="flex items-center gap-3">
              <span className="site-muted font-mono text-sm font-semibold tracking-wider" aria-live="polite">
                {String(activePaymentSlide + 1).padStart(2, "0")} <span className="opacity-50">/</span> {String(visiblePaymentSlides.length).padStart(2, "0")}
              </span>
              <button
                aria-label="Previous payment methods"
                className="payment-carousel-control"
                disabled={visiblePaymentSlides.length < 2}
                onClick={() => setPaymentSlide((n) => (n + visiblePaymentSlides.length - 1) % visiblePaymentSlides.length)}
                type="button"
              >
                <span aria-hidden="true">←</span>
              </button>
              <button
                aria-label="Next payment methods"
                className="payment-carousel-control"
                disabled={visiblePaymentSlides.length < 2}
                onClick={() => setPaymentSlide((n) => (n + 1) % visiblePaymentSlides.length)}
                type="button"
              >
                <span aria-hidden="true">→</span>
              </button>
            </div>
          </div>

          <div className="payment-carousel-frame">
            <div
              aria-atomic="true"
              aria-live="polite"
              className="payment-slide"
              key={paymentSlide}
              role="group"
              aria-label={`${activePaymentSlide + 1} of ${visiblePaymentSlides.length}`}
              aria-roledescription="slide"
            >
              <div className="payment-slide-heading">
                <div className="flex min-w-0 items-center gap-4">
                  <span className="payment-slide-icon" aria-hidden="true">
                    {visiblePaymentSlides[activePaymentSlide].category === "Digital payments" ? (
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
                        <rect x="3" y="5" width="18" height="14" rx="2" />
                        <path d="M3 10h18M7 15h4" />
                      </svg>
                    ) : (
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M3 9h18M5 9v10m4-10v10m6-10v10m4-10v10M3 19h18M12 4l9 5H3l9-5Z" />
                      </svg>
                    )}
                  </span>
                  <div>
                    <p>{visiblePaymentSlides[activePaymentSlide].category}</p>
                    <h3>{visiblePaymentSlides[activePaymentSlide].title}</h3>
                  </div>
                </div>
                <span className="hidden rounded-full border border-white/25 bg-white/10 px-3 py-1.5 text-xs font-semibold text-white/90 sm:inline-flex">
                  {visiblePaymentSlides[activePaymentSlide].methods.length} options
                </span>
              </div>
              <ul className="payment-method-grid">
                {visiblePaymentSlides[activePaymentSlide].methods.map((method) => (
                  <li className="payment-method-card" key={method.id}>
                    <span className="payment-method-mark" aria-hidden="true">
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
                        <rect x="3" y="5" width="18" height="14" rx="3" />
                        <path d="M3 10h18M7 15h4" />
                      </svg>
                    </span>
                    <span>{method.name}</span>
                    <svg className="payment-method-arrow" viewBox="0 0 20 20" fill="none" aria-hidden="true">
                      <path d="M4 10h11m-4-4 4 4-4 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  </li>
                ))}
              </ul>
              <div className="payment-slide-footer">
                <span>Payment method list</span>
                <div className="flex items-center gap-2" aria-label="Payment slide selection">
                  {visiblePaymentSlides.map((slide, index) => (
                    <button
                      aria-current={activePaymentSlide === index ? "true" : undefined}
                      aria-label={`Show ${slide.title}`}
                      className={`payment-slide-indicator${activePaymentSlide === index ? " is-active" : ""}`}
                      key={`${slide.category}-${slide.title}`}
                      onClick={() => setPaymentSlide(index)}
                      type="button"
                    />
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* HOW IT WORKS */}
      <section id="how" className="landing-reorderable landing-steps-section site-surface-bg pb-[170px] pt-20">
        <div className={wrap}>
          <h2 className={h2}>{content.stepsHeading}</h2>
          <ol className="mt-9 grid list-none grid-cols-[repeat(auto-fit,minmax(250px,1fr))] gap-[26px] p-0">
            {steps.map((item, n) => (
              <li key={item.id} className="flex items-start gap-4">
                <span className="site-primary-bg grid h-[46px] w-[46px] flex-none place-items-center rounded-full border-2 font-display font-extrabold text-white">{n + 1}</span>
                <div>
                  <h3 className="site-text mb-1.5 mt-0.5 font-display text-lg font-bold">{item.title}</h3>
                  <p className="site-muted leading-normal">{item.text}</p>
                </div>
              </li>
            ))}
          </ol>
        </div>
      </section>

      {/* FIXED FOOTER */}
      <footer id="app" className="site-footer fixed inset-x-0 bottom-0 z-50 border-t border-white/15 px-[clamp(12px,4vw,48px)] pt-2.5 pb-[calc(10px+env(safe-area-inset-bottom,0px))] text-white backdrop-blur-xl">
        <div className="mx-auto flex max-w-[1180px] items-center justify-between gap-3">
          <StoreButton logo={<GooglePlayLogo />} small="Coming soon on" name="Google Play" />
          <p className="hidden text-center text-[.9rem] text-white/80 sm:block">{content.footerTagline}</p>
          <StoreButton logo={<AppleLogo />} small="Coming soon on the" name="App Store" />
        </div>
      </footer>
    </div>
  );
}
