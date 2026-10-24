import { useEffect, useRef, useState } from "react";
import heroImg from "./assets/hero.jpg";
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

const ANNOUNCEMENTS = [
  ["Water interruption", "Pahibalo sa schedule sa maintenance sa inyong barangay."],
  ["Meter reading", "Ang pagbasa sa metro mahitabo sa sinugdanan sa matag bulan."],
  ["Payment reminder", "Bayri sa dili pa ang due date aron likayan ang penalty."],
];

const SERVICES = [
  ["Online payment", "Bayad gamit ang imong account number. Naay receipt dayon."],
  ["Bill inquiry", "Susiha ang imong current balance ug due date bisan asa."],
  ["New connection", "Pag-apply og bag-ong koneksyon ug sunda ang status sa imong application."],
  ["Leak & service report", "I-report ang tulo, putol nga tubo, o walay tubig sa inyong lugar."],
  ["Consumption history", "Tan-awa kung pila ka cubic meter ang nagamit kada bulan."],
  ["Announcements", "Madawat ang schedule sa maintenance ug uban pang pahibalo."],
];

const STEPS = [
  ["Ibutang ang account number", "Makita kini sa imong water bill."],
  ["Tan-awa ang bill", "Klaro ang amount, due date, ug consumption."],
  ["Bayri ug kuhaa ang receipt", "Kompleto na, mahatagan ka og proof of payment."],
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

export default function LandingPage({ onSearchBill }) {
  const [i, setI] = useState(0);
  const touchX = useRef(0);
  const go = (n) => setI((n + SLIDES.length) % SLIDES.length);

  useEffect(() => {
    const id = setInterval(() => setI((n) => (n + 1) % SLIDES.length), 4500);
    return () => clearInterval(id);
  }, []);

  const h2 = "font-display font-bold text-[clamp(1.9rem,4vw,2.9rem)] tracking-tight text-[#1c1e21]";
  const wrap = "mx-auto max-w-[1180px] px-[clamp(16px,5vw,48px)]";

  return (
    <div className="pb-0">
      {/* NAV (scrolls with the page) */}
      <header className="absolute inset-x-0 top-0 z-20 flex items-center justify-between px-[clamp(16px,5vw,64px)] pt-[calc(16px+env(safe-area-inset-top,0px))] pb-4 text-white">
        <a href="#top" className="flex items-center gap-2.5 font-display text-[1.1rem] font-medium">
          <svg viewBox="0 0 40 40" width="34" height="34" className="drop-shadow-[0_3px_5px_rgba(0,0,0,.4)]" aria-hidden="true">
            <path d="M20 3C12 14 6 21 6 27a14 14 0 0 0 28 0c0-6-6-13-14-24z" fill="#0866ff" />
            <path d="M12 28c3-3 5-3 8 0s5 3 8 0" stroke="#fff" strokeWidth="2.2" fill="none" strokeLinecap="round" />
          </svg>
          <span>Hinunangan <b className="font-extrabold">Water</b></span>
        </a>
        <nav className="flex items-center gap-6 text-[.95rem] font-semibold">
          <a className="hidden md:inline hover:text-[#0866ff]" href="#services">Services</a>
          <a className="hidden md:inline hover:text-[#0866ff]" href="#how">How it works</a>
          <a className="hidden md:inline hover:text-[#0866ff]" href="#app">Mobile app</a>
          <button type="button" onClick={onSearchBill} className="inline-flex items-center gap-2 rounded-full bg-[#0866ff] px-[18px] py-[9px] font-bold text-white shadow-[0_8px_24px_rgba(8,102,255,.35)]">
            <SearchIcon />Search Bill
          </button>
        </nav>
      </header>

      {/* HERO SLIDESHOW */}
      <section id="top"
        className="hero-bg relative flex min-h-svh flex-col justify-center overflow-hidden pb-[120px] text-white"
        onTouchStart={(e) => (touchX.current = e.touches[0].clientX)}
        onTouchEnd={(e) => {
          const dx = e.changedTouches[0].clientX - touchX.current;
          if (Math.abs(dx) > 50) go(i + (dx < 0 ? 1 : -1));
        }}>
        <div className="hero-photo" style={{ backgroundImage: `url(${heroImg})` }} aria-hidden="true" />

        <div className="pointer-events-none absolute inset-0" aria-hidden="true">
          {Array.from({ length: 10 }).map((_, n) => (
            <span key={n} className="absolute -bottom-8 animate-rise rounded-full bg-white/15"
              style={{ left: `${8 + n * 9}%`, animationDelay: `${n * 0.9}s`, width: 8 + (n % 4) * 6, height: 8 + (n % 4) * 6 }} />
          ))}
        </div>

        <div className="relative z-[5] mx-auto grid min-h-[520px] w-full max-w-[1180px] px-[clamp(16px,5vw,48px)] pb-5 pt-24 md:min-h-[430px] md:pt-[110px]">
          {SLIDES.map((s, n) => (
            <article key={s.key} aria-hidden={n !== i}
              className={`col-start-1 row-start-1 grid grid-cols-1 items-center gap-10 transition-all duration-700 md:grid-cols-[1.1fr_.9fr] ${n === i ? "visible translate-x-0 opacity-100" : "invisible translate-x-10 opacity-0"}`}>
              <div>
                <p className="mb-3.5 font-semibold text-[#dce9ff]">Hinunangan Water Billing System</p>
                <h1 className="mb-5 font-display text-[clamp(2.6rem,7vw,5.2rem)] font-extrabold leading-none tracking-tight">{s.title}</h1>
                <p className="mb-8 max-w-[34em] text-[clamp(1.05rem,2vw,1.25rem)] leading-relaxed text-[#e8f0ff]">{s.text}</p>
                <div className="flex flex-wrap gap-3.5">
                  {s.key === "payment" ? (
                    <button type="button" onClick={onSearchBill} tabIndex={n === i ? 0 : -1} className="inline-flex items-center gap-2 rounded-full bg-[#0866ff] px-[26px] py-3.5 font-bold text-white shadow-[0_8px_24px_rgba(8,102,255,.35)] transition hover:-translate-y-0.5">
                      <SearchIcon />Search Bill
                    </button>
                  ) : (
                    <a href="#top" tabIndex={n === i ? 0 : -1} className="rounded-full bg-[#0866ff] px-[26px] py-3.5 font-bold text-white shadow-[0_8px_24px_rgba(8,102,255,.35)] transition hover:-translate-y-0.5">{s.cta}</a>
                  )}
                  <a href="#services" tabIndex={n === i ? 0 : -1} className="rounded-full px-[26px] py-3.5 font-bold text-white shadow-[inset_0_0_0_2px_rgba(255,255,255,.55)]">Learn more</a>
                </div>
              </div>
              <div aria-hidden="true" className="relative order-first grid aspect-square w-full max-w-[180px] place-items-center justify-self-start md:order-none md:max-w-[380px] md:justify-self-center">
                <div className="absolute inset-[6%] animate-ring rounded-full border-2 border-white/30" />
                <div className="absolute -inset-[4%] animate-ring rounded-full border-2 border-white/30 [animation-delay:1.3s]" />
                <svg viewBox="0 0 100 100" className="w-[62%] animate-float rounded-full bg-white/10 fill-white/10 stroke-white p-[18%]"
                  strokeWidth="3.2" strokeLinecap="round" strokeLinejoin="round">{s.icon}</svg>
              </div>
            </article>
          ))}
        </div>

        <div className="relative z-[5] mb-6 mt-2 flex items-center justify-center gap-[18px]">
          <button aria-label="Previous slide" onClick={() => go(i - 1)} className="h-[42px] w-[42px] rounded-full border-2 border-white/50 text-2xl leading-none hover:bg-white/15">‹</button>
          <div className="flex gap-2.5">
            {SLIDES.map((s, n) => (
              <button key={s.key} aria-label={`Go to ${s.title}`} onClick={() => go(n)}
                className={`h-3 rounded-full transition-all duration-300 ${n === i ? "w-9 bg-[#0866ff]" : "w-3 bg-white/40"}`} />
            ))}
          </div>
          <button aria-label="Next slide" onClick={() => go(i + 1)} className="h-[42px] w-[42px] rounded-full border-2 border-white/50 text-2xl leading-none hover:bg-white/15">›</button>
        </div>

        {/* Transparent announcements */}
        <div className={`${wrap} relative z-[5] w-full`}>
          <aside aria-label="Announcements" className="rounded-[22px] border border-white/30 bg-white/10 px-[22px] py-[18px] backdrop-blur-xl">
            <h2 className="mb-3 flex items-center gap-2 font-display text-[1.05rem] font-bold">
              <span className="h-[9px] w-[9px] animate-ring rounded-full bg-[#0866ff]" />Announcements
            </h2>
            <div className="grid grid-cols-[repeat(auto-fit,minmax(230px,1fr))] gap-x-[22px] gap-y-3">
              {ANNOUNCEMENTS.map(([t, d]) => (
                <div key={t} className="border-l-[3px] border-[#0866ff] pl-3">
                  <b className="block text-[.95rem]">{t}</b>
                  <span className="text-[.85rem] leading-snug text-[#e8f0ff]">{d}</span>
                </div>
              ))}
            </div>
          </aside>
        </div>

        <svg className="absolute -bottom-px left-0 h-[110px] w-full" viewBox="0 0 1440 120" preserveAspectRatio="none" aria-hidden="true">
          <path className="animate-drift fill-white/35" d="M0 60c120-40 240-40 360 0s240 40 360 0 240-40 360 0 240 40 360 0v60H0z" />
          <path className="fill-[#f0f2f5]" d="M0 80c120-30 240-30 360 0s240 30 360 0 240-30 360 0 240 30 360 0v40H0z" />
        </svg>
      </section>

      {/* SERVICES */}
      <section id="services" className="bg-[#f0f2f5] py-20">
        <div className={wrap}>
          <h2 className={`${h2} mb-2.5`}>Tanang kinahanglan nimo sa tubig, usa ka lugar</h2>
          <p className="mb-10 text-[1.1rem] text-[#65676b]">Dili na kinahanglan moadto sa opisina para sa kasagarang transaksyon.</p>
          <div className="grid grid-cols-[repeat(auto-fit,minmax(260px,1fr))] gap-5">
            {SERVICES.map(([t, d]) => (
              <div key={t} className="rounded-[22px_22px_22px_6px] border border-[#e4e6eb] bg-white p-[26px] shadow-sm transition duration-300 hover:-translate-y-1 hover:shadow-xl motion-reduce:transform-none motion-reduce:transition-none">
                <span className="block h-[26px] w-[26px] rotate-45 rounded-[0_50%_50%_50%] bg-[#0866ff]" />
                <h3 className="mb-2 mt-3.5 font-display text-xl font-bold text-[#1c1e21]">{t}</h3>
                <p className="leading-relaxed text-[#65676b]">{d}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* HOW IT WORKS */}
      <section id="how" className="bg-white pb-[170px] pt-20">
        <div className={wrap}>
          <h2 className={h2}>Pagbayad sa tulo ka lakang</h2>
          <ol className="mt-9 grid list-none grid-cols-[repeat(auto-fit,minmax(250px,1fr))] gap-[26px] p-0">
            {STEPS.map(([t, d], n) => (
              <li key={t} className="flex items-start gap-4">
                <span className="grid h-[46px] w-[46px] flex-none place-items-center rounded-full border-2 border-[#0866ff] bg-[#0866ff] font-display font-extrabold text-white">{n + 1}</span>
                <div>
                  <h3 className="mb-1.5 mt-0.5 font-display text-lg font-bold text-[#1c1e21]">{t}</h3>
                  <p className="leading-normal text-[#65676b]">{d}</p>
                </div>
              </li>
            ))}
          </ol>
        </div>
      </section>

      {/* FIXED FOOTER */}
      <footer id="app" className="fixed inset-x-0 bottom-0 z-50 border-t border-white/15 bg-[#0866ff]/85 px-[clamp(12px,4vw,48px)] pt-2.5 pb-[calc(10px+env(safe-area-inset-bottom,0px))] text-white backdrop-blur-xl">
        <div className="mx-auto flex max-w-[1180px] items-center justify-between gap-3">
          <StoreButton logo={<GooglePlayLogo />} small="Coming soon on" name="Google Play" />
          <p className="hidden text-center text-[.9rem] text-white/80 sm:block"><b>Mobile app</b> coming soon</p>
          <StoreButton logo={<AppleLogo />} small="Coming soon on the" name="App Store" />
        </div>
      </footer>
    </div>
  );
}
