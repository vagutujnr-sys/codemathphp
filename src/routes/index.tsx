import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import {
  ArrowRight,
  ArrowUpRight,
  Code2,
  Smartphone,
  Palette,
  ShoppingBag,
  TrendingUp,
  Cpu,
  ShieldCheck,
  Sparkles,
  CheckCircle2,
  Mail,
  MessageCircle,
  MapPin,
  Clock,
  Zap,
  Facebook,
  Instagram,
  Linkedin,
  Youtube,
  LockKeyhole,
} from "lucide-react";
import logo from "@/assets/codemath-logo.png";
import heroImg from "@/assets/hero-team.png";
import meetingImg from "@/assets/client-meeting.jpg";
import { ProjectDialogProvider, useProjectDialog } from "@/components/ProjectDialog";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "CodeMath — African Dev House Since 2009 | Web, App & Systems" },
      {
        name: "description",
        content:
          "CodeMath builds websites, mobile apps, online stores and custom software for Zimbabwe, South Africa and beyond. Get online in 24 hours for $27.50.",
      },
      { property: "og:title", content: "CodeMath — You Think It. We Build It." },
      { property: "og:description", content: "Premium software development from Africa since 2009. Website special: $27.50, live in 24 hours." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: () => (
    <ProjectDialogProvider>
      <Index />
    </ProjectDialogProvider>
  ),
});

const services = [
  { icon: Code2, title: "Website Design & Development", text: "Corporate sites, landing pages and client portals — fast to load, easy for your team to update, and readable the moment they open on a phone.", tags: ["Corporate sites", "Landing pages", "Client portals"], form: "Web Development" },
  { icon: Smartphone, title: "Mobile App Development", text: "Android and iOS apps shaped around how your customers really use a phone, from simple booking to full account-based systems.", tags: ["Android", "iOS", "Cross-platform"], form: "Mobile App Development" },
  { icon: Palette, title: "Graphics, Branding & Print", text: "Logos, brand kits, flyers, signage and social templates, so one business looks like one business on every surface.", tags: ["Logo & brand kits", "Print & signage", "Social templates"], form: "Graphic Design & Branding" },
  { icon: ShoppingBag, title: "Online Stores & E-commerce", text: "Shops that take card and mobile-money payments, keep stock accurate, and handle delivery the way your market actually buys.", tags: ["Catalogue & stock", "Payments & delivery", "Mobile money"], form: "Online Store & E-commerce" },
  { icon: TrendingUp, title: "SEO & Digital Marketing", text: "Being found by people already searching for what you sell — local search, content and campaigns reported in real enquiries.", tags: ["Search & local SEO", "Google Ads", "Content"], form: "SEO & Digital Marketing" },
  { icon: Cpu, title: "Custom Software & Automation", text: "Dashboards, internal tools and integrations that replace the spreadsheet-and-WhatsApp workflow your team has outgrown.", tags: ["Dashboards", "Integrations", "Automation"], form: "Business Dashboards" },
];

const countries = [
  ["🇿🇼", "Zimbabwe"], ["🇿🇦", "South Africa"], ["🇧🇼", "Botswana"], ["🇿🇲", "Zambia"],
  ["🇳🇦", "Namibia"], ["🇬🇧", "United Kingdom"], ["🇺🇸", "United States"], ["🇰🇾", "Cayman Islands"],
];

type Project = { name: string; cat: string; tag: string; text: string; headline: string; accent: string; stats: [string, string][] };
const projects: Project[] = [
  { name: "Isimilo Investments", cat: "Websites", tag: "Logistics · Website", headline: "Moving Your Cargo Across Borders", text: "Zimbabwe's cross-border freight brand: clearing, forwarding and quote requests that land straight in the sales team's inbox.", accent: "from-primary to-primary-glow", stats: [["3×", "more enquiries"], ["1.2s", "load time"]] },
  { name: "Betadeck", cat: "Web Apps", tag: "SaaS · Web App", headline: "Unlimited Client Panels on Your Domain", text: "A white-label platform letting hosting providers give every customer their own branded control panel.", accent: "from-secondary to-primary", stats: [["SaaS", "subscription"], ["100%", "white-label"]] },
  { name: "Hustle Creations", cat: "Websites", tag: "E-learning · Store", headline: "Create Your Own Wardrobe", text: "Online sewing courses, machine sales and accessories in one place — built to turn a craft into a career.", accent: "from-primary-glow to-secondary", stats: [["Courses", "+ shop"], ["Mobile", "first"]] },
  { name: "Retail Pulse", cat: "Dashboards", tag: "Retail · Dashboard", headline: "Every Branch. One Screen.", text: "Live sales, stock and staff performance across branches, replacing end-of-day spreadsheets.", accent: "from-secondary to-primary-glow", stats: [["Real-time", "reports"], ["0", "spreadsheets"]] },
  { name: "BookIt Salon", cat: "Mobile Apps", tag: "Beauty · Mobile App", headline: "Book Your Chair in 3 Taps", text: "Android and iOS booking app with reminders and deposits that cut no-shows for busy salons.", accent: "from-primary to-secondary", stats: [["Android", "+ iOS"], ["Fewer", "no-shows"]] },
];
const cats = ["All", "Websites", "Web Apps", "Mobile Apps", "Dashboards"];
const socialIcons = [
  [Facebook, "Facebook"],
  [Instagram, "Instagram"],
  [Linkedin, "LinkedIn"],
  [Youtube, "YouTube"],
] as const;

const process = [
  ["01", "Discover", "We unpack your goals, customers and numbers."],
  ["02", "Design", "Clickable prototypes before a single line of code."],
  ["03", "Build", "Agile sprints with weekly demos you can test."],
  ["04", "Launch & Grow", "Go live, measure, support and keep improving."],
];

function BrowserMock({ p, big }: { p: Project; big?: boolean }) {
  return (
    <div className="overflow-hidden rounded-sm border border-border bg-card shadow-card">
      <div className="flex items-center gap-1.5 border-b border-border bg-muted px-3 py-2">
        <span className="h-2.5 w-2.5 rounded-full bg-destructive/70" />
        <span className="h-2.5 w-2.5 rounded-full bg-chart-4" />
        <span className="h-2.5 w-2.5 rounded-full bg-chart-3" />
        <span className="ml-3 flex-1 truncate rounded-sm bg-card px-2 py-0.5 font-mono text-[10px] text-muted-foreground">
          {p.name.toLowerCase().replace(/\s+/g, "")}.co.zw
        </span>
      </div>
      <div className={`relative bg-gradient-to-br ${p.accent} ${big ? "p-10 md:p-14" : "p-6"}`}>
        <div className="absolute inset-0 bg-grid opacity-15" />
        <div className="relative flex items-center justify-between">
          <span className="h-2 w-16 rounded-sm bg-primary-foreground/80" />
          <div className="flex gap-2">
            {[0, 1, 2].map((i) => <span key={i} className="h-1.5 w-8 rounded-sm bg-primary-foreground/40" />)}
          </div>
        </div>
        <h4 className={`relative mt-8 max-w-sm font-display font-extrabold leading-tight text-primary-foreground ${big ? "text-3xl md:text-4xl" : "text-lg"}`}>
          {p.headline}
        </h4>
        <div className="relative mt-4 flex gap-2">
          <span className="h-6 w-20 rounded-sm bg-primary-foreground" />
          <span className="h-6 w-16 rounded-sm border border-primary-foreground/70" />
        </div>
        {big && (
          <div className="relative mt-10 grid grid-cols-3 gap-3">
            {[0, 1, 2].map((i) => <div key={i} className="h-16 rounded-sm bg-primary-foreground/15 backdrop-blur" />)}
          </div>
        )}
      </div>
    </div>
  );
}

function Portfolio() {
  const { open } = useProjectDialog();
  const [cat, setCat] = useState("All");
  const [active, setActive] = useState(0);
  const list = projects.filter((p) => cat === "All" || p.cat === cat);
  const featured = list[Math.min(active, list.length - 1)] ?? projects[0];

  return (
    <section id="work" className="relative overflow-hidden bg-secondary py-28 text-secondary-foreground">
      <div className="absolute inset-0 bg-grid opacity-[0.06]" />
      <div className="absolute -right-40 -top-40 h-[32rem] w-[32rem] rounded-full bg-primary/25 blur-3xl" />
      <div className="relative mx-auto max-w-7xl px-6">
        <div className="flex flex-wrap items-end justify-between gap-8">
          <div>
            <p className="font-mono text-sm text-primary-glow">/ portfolio</p>
            <h2 className="mt-3 max-w-2xl font-display text-4xl font-bold tracking-tight md:text-6xl">
              Work that moves <span className="text-primary-glow">businesses</span> forward.
            </h2>
          </div>
          <div className="flex flex-wrap gap-2">
            {cats.map((c) => (
              <button
                key={c}
                onClick={() => { setCat(c); setActive(0); }}
                className={`rounded-sm border px-4 py-2 font-mono text-xs uppercase tracking-wider transition-colors ${
                  cat === c ? "border-primary bg-primary text-primary-foreground" : "border-secondary-foreground/20 text-secondary-foreground/70 hover:border-primary-glow hover:text-secondary-foreground"
                }`}
              >
                {c}
              </button>
            ))}
          </div>
        </div>

        <div className="mt-14 grid gap-10 lg:grid-cols-[1.4fr_1fr]">
          <div key={featured.name} className="animate-rise">
            <div className="animate-float"><BrowserMock p={featured} big /></div>
            <div className="mt-8 flex flex-wrap items-end justify-between gap-6">
              <div className="max-w-lg">
                <span className="font-mono text-xs uppercase tracking-widest text-primary-glow">{featured.tag}</span>
                <h3 className="mt-2 font-display text-3xl font-bold">{featured.name}</h3>
                <p className="mt-3 text-secondary-foreground/70">{featured.text}</p>
              </div>
              <div className="flex gap-8">
                {featured.stats.map(([v, l]) => (
                  <div key={l}>
                    <p className="font-display text-3xl font-extrabold text-primary-glow">{v}</p>
                    <p className="text-xs uppercase tracking-wider text-secondary-foreground/60">{l}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <ol className="divide-y divide-secondary-foreground/10 border-y border-secondary-foreground/10">
            {list.map((p, i) => (
              <li key={p.name}>
                <button
                  onMouseEnter={() => setActive(i)}
                  onClick={() => setActive(i)}
                  className={`group flex w-full items-center gap-5 py-6 text-left transition-all ${featured.name === p.name ? "pl-4" : ""}`}
                >
                  <span className={`font-mono text-sm ${featured.name === p.name ? "text-primary-glow" : "text-secondary-foreground/40"}`}>
                    0{i + 1}
                  </span>
                  <span className="flex-1">
                    <span className={`block font-display text-2xl font-bold transition-colors ${featured.name === p.name ? "text-secondary-foreground" : "text-secondary-foreground/50 group-hover:text-secondary-foreground"}`}>
                      {p.name}
                    </span>
                    <span className="text-xs uppercase tracking-wider text-secondary-foreground/50">{p.tag}</span>
                  </span>
                  <ArrowUpRight className={`h-6 w-6 transition-all ${featured.name === p.name ? "rotate-45 text-primary-glow" : "text-secondary-foreground/30"}`} />
                </button>
              </li>
            ))}
            <li className="py-6">
              <button onClick={() => open()} className="inline-flex items-center gap-2 font-bold text-primary-glow hover:gap-3 transition-all">
                Your project could be next <ArrowRight className="h-4 w-4" />
              </button>
            </li>
          </ol>
        </div>
      </div>
    </section>
  );
}

function Special() {
  const { open } = useProjectDialog();
  return (
    <section id="special" className="mx-auto max-w-7xl px-6 py-24">
      <div className="relative grid overflow-hidden rounded-sm border-2 border-primary bg-card shadow-elegant lg:grid-cols-[1.3fr_1fr]">
        <div className="relative p-10 md:p-14">
          <span className="inline-flex items-center gap-2 rounded-sm bg-primary px-3 py-1 font-mono text-xs font-bold uppercase tracking-widest text-primary-foreground animate-pulse-ring">
            <Zap className="h-3.5 w-3.5" /> Limited time only
          </span>
          <h2 className="mt-6 font-display text-4xl font-extrabold tracking-tight text-secondary md:text-5xl">
            Your business online in <span className="text-primary">24 hours.</span>
          </h2>
          <p className="mt-4 max-w-lg text-lg text-muted-foreground">
            Give your business a professional digital face — fast. We design, build and launch your website so customers can find you, trust you and contact you by tomorrow.
          </p>
          <ul className="mt-8 grid gap-3 sm:grid-cols-2">
            {["Professional one-page website", "Mobile-friendly design", "WhatsApp & call buttons", "Live within 24 hours"].map((t) => (
              <li key={t} className="flex items-center gap-2 font-medium text-secondary">
                <CheckCircle2 className="h-5 w-5 text-primary" /> {t}
              </li>
            ))}
          </ul>
        </div>
        <div className="relative flex flex-col justify-center bg-gradient-primary p-10 text-primary-foreground md:p-14">
          <div className="absolute inset-0 bg-grid opacity-10" />
          <div className="relative">
            <p className="font-mono text-xs uppercase tracking-widest opacity-90">Web development special</p>
            <p className="mt-3 font-display text-7xl font-extrabold leading-none md:text-8xl">
              $27<span className="text-4xl md:text-5xl">.50</span>
            </p>
            <p className="mt-3 flex items-center gap-2 text-sm font-semibold"><Clock className="h-4 w-4" /> Online & running in 24 hours</p>
            <button
              onClick={() => open("$27.50 Website Special (24hr)")}
              className="mt-8 inline-flex w-full items-center justify-center gap-2 rounded-sm bg-card px-6 py-4 font-bold text-secondary transition-transform hover:-translate-y-0.5"
            >
              Claim this offer <ArrowRight className="h-4 w-4" />
            </button>
          </div>
        </div>
      </div>
    </section>
  );
}

function Index() {
  const { open } = useProjectDialog();
  const years = new Date().getFullYear() - 2009;
  const primaryBtn = "inline-flex items-center gap-2 rounded-sm bg-gradient-primary font-bold text-primary-foreground shadow-elegant transition-transform hover:-translate-y-0.5";

  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="sticky top-0 z-40 border-b border-border/70 bg-background/85 backdrop-blur">
        <div className="border-b border-primary/80 bg-primary">
          <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-x-6 gap-y-2 px-6 py-2 text-xs font-medium text-primary-foreground">
            <div className="flex items-center gap-4">
              <span>Privacy Policy</span>
              <span aria-hidden="true" className="h-3 w-px bg-primary-foreground/40" />
              <span>Terms &amp; Conditions</span>
            </div>
            <div className="flex items-center gap-5">
              <a href="mailto:developers@codemathphp.co.za" className="transition-opacity hover:opacity-80">
                developers@codemathphp.co.za
              </a>
              <div aria-label="Social media" className="flex items-center gap-3">
                {socialIcons.map(([Icon, name]) => (
                  <span key={name} role="img" aria-label={`${name} profile coming soon`}>
                    <Icon aria-hidden="true" className="h-4 w-4" />
                  </span>
                ))}
              </div>
            </div>
          </div>
        </div>
        <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-4">
          <a href="#top" aria-label="CodeMath home">
            <img src={logo} alt="CodeMath — You Think It. We Built It." className="h-11 w-auto" />
          </a>
          <div className="ml-auto flex items-center gap-3 md:gap-8">
            <nav className="hidden items-center gap-7 text-sm font-semibold md:flex">
              <span aria-disabled="true" className="cursor-default text-muted-foreground">Digital Products</span>
              <a href="#services" className="hover:text-primary">Services</a>
              <a href="#work" className="hover:text-primary">Portfolio</a>
              <a href="#special" className="text-primary">$27.50 Special</a>
              <a href="#about" className="hover:text-primary">About</a>
            </nav>
            <Link
              to="/portal"
              className="inline-flex items-center gap-2 rounded-sm border border-primary/30 bg-accent px-3 py-2.5 text-sm font-bold text-accent-foreground transition-colors hover:border-primary hover:bg-primary hover:text-primary-foreground sm:px-4"
            >
              <LockKeyhole aria-hidden="true" className="h-4 w-4" />
              Client Portal
            </Link>
            <button onClick={() => open()} className={`${primaryBtn} px-5 py-2.5 text-sm`}>Start a Project</button>
          </div>
        </div>
      </header>

      <section id="top" className="relative overflow-hidden">
        <div className="absolute inset-0 bg-grid opacity-50 [mask-image:radial-gradient(ellipse_at_top_left,black,transparent_70%)]" />
        <div className="absolute inset-0 bg-gradient-warm" />
        <div className="relative mx-auto grid max-w-7xl items-center gap-14 px-6 pb-8 pt-6 lg:grid-cols-2 lg:pt-8">
          <div className="animate-rise">
            <span className="inline-flex items-center gap-2 rounded-sm border border-primary/30 bg-accent px-4 py-1.5 font-mono text-xs font-medium text-accent-foreground">
              <Sparkles className="h-3.5 w-3.5" /> Proudly African · Building since 2009
            </span>
            <h1 className="mt-6 font-display text-5xl font-extrabold leading-[1.05] tracking-tight text-secondary md:text-6xl lg:text-7xl">
              You think it.<br />
              <span className="bg-gradient-primary bg-clip-text text-transparent">We build it.</span>
            </h1>
            <p className="mt-6 max-w-xl text-lg leading-relaxed text-muted-foreground">
              CodeMath is a Zimbabwean & South African dev house crafting websites, mobile apps and
              business systems that help ambitious African companies compete with the world.
            </p>
            <div className="mt-9 flex flex-wrap gap-4">
              <button onClick={() => open()} className={`${primaryBtn} group px-7 py-4`}>
                Start your project <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
              </button>
              <a href="#special" className="inline-flex items-center gap-2 rounded-sm border-2 border-secondary px-7 py-4 font-bold text-secondary transition-colors hover:bg-secondary hover:text-secondary-foreground">
                Online in 24hrs — $27.50
              </a>
            </div>
          </div>
          <div className="relative animate-rise [animation-delay:150ms]">
            <img src={heroImg} alt="CodeMath developers collaborating in the studio" width={1536} height={1152} className="relative aspect-[4/3] w-full rounded-sm bg-transparent object-cover" />
            <div className="absolute -bottom-8 -left-6 rounded-sm border border-border bg-card p-5 shadow-card">
              <pre className="font-mono text-xs leading-relaxed text-muted-foreground">
                <span className="text-primary">const</span> client = <span className="text-secondary">"you"</span>;{"\n"}
                <span className="text-primary">await</span> codemath.build(idea);{"\n"}
                <span className="text-chart-3">// ✓ shipped, scaled, loved</span>
              </pre>
            </div>
          </div>
        </div>
      </section>

      <section className="border-y border-border bg-card py-6">
        <p className="mb-4 text-center font-mono text-xs uppercase tracking-[0.25em] text-muted-foreground">Trusted by clients across</p>
        <div className="overflow-hidden [mask-image:linear-gradient(90deg,transparent,black_10%,black_90%,transparent)]">
          <div className="flex w-max animate-marquee gap-12">
            {[...countries, ...countries].map(([f, n], i) => (
              <span key={i} className="flex items-center gap-3 whitespace-nowrap font-display text-lg font-semibold text-secondary">
                <span className="text-2xl">{f}</span> {n}
              </span>
            ))}
          </div>
        </div>
      </section>

      <section id="services" className="mx-auto max-w-7xl px-6 py-28">
        <div className="max-w-2xl">
          <p className="font-mono text-sm font-medium text-primary">/ what we build</p>
          <h2 className="mt-3 font-display text-4xl font-bold tracking-tight text-secondary md:text-5xl">Full-stack capability, under one roof.</h2>
        </div>
        <div className="mt-14 grid border-l border-t border-border sm:grid-cols-2 lg:grid-cols-3">
          {services.map(({ icon: Icon, title, text, tags, form }, i) => (
            <div key={title} className="group relative flex flex-col border-b border-r border-border bg-card p-8 transition-colors hover:bg-accent/40">
              <span className="absolute left-0 top-0 h-1 w-0 bg-gradient-primary transition-all duration-500 group-hover:w-full" />
              <div className="flex items-center justify-between">
                <span className="font-mono text-xs text-primary">0{i + 1}</span>
                <Icon className="h-6 w-6 text-secondary/60 transition-colors group-hover:text-primary" />
              </div>
              <h3 className="mt-6 font-display text-2xl font-bold text-secondary">{title}</h3>
              <p className="mt-3 flex-1 text-muted-foreground">{text}</p>
              <div className="mt-6 flex flex-wrap gap-2">
                {tags.map((t) => (
                  <span key={t} className="border border-border px-2.5 py-1 font-mono text-[10px] uppercase tracking-widest text-muted-foreground">{t}</span>
                ))}
              </div>
              <button onClick={() => open(form)} className="mt-6 inline-flex items-center gap-1 self-start text-sm font-bold text-primary opacity-80 transition-all hover:gap-2 hover:opacity-100">
                Enquire <ArrowRight className="h-4 w-4" />
              </button>
            </div>
          ))}
        </div>
      </section>

      <Portfolio />
      <Special />

      <section id="about" className="mx-auto grid max-w-7xl items-center gap-16 px-6 py-24 lg:grid-cols-2">
        <div className="relative">
          <img src={meetingImg} alt="A CodeMath developer reviewing an app with a client" width={1200} height={1408} loading="lazy" className="aspect-[4/5] w-full rounded-sm object-cover shadow-card" />
          <div className="absolute -right-4 top-10 rounded-sm bg-gradient-primary p-6 text-primary-foreground shadow-elegant md:-right-8">
            <p className="font-display text-5xl font-extrabold">2009</p>
            <p className="text-sm font-semibold">Building Africa's digital future</p>
          </div>
        </div>
        <div>
          <p className="font-mono text-sm font-medium text-primary">/ about codemath</p>
          <h2 className="mt-3 font-display text-4xl font-bold tracking-tight text-secondary md:text-5xl">African talent. Global standards.</h2>
          <p className="mt-6 text-lg leading-relaxed text-muted-foreground">
            For over {years} years we've partnered with businesses from Harare to Johannesburg, Gaborone to George Town. We understand local markets — mobile money, patchy data, multi-currency — and build software that performs where your customers actually are.
          </p>
          <ul className="mt-8 space-y-4">
            {["Local payments: EcoCash, PayFast, Paynow, Stripe & more", "Fast, data-light experiences built for African networks", "Dedicated project manager and weekly progress", "Ongoing support, hosting and maintenance after launch"].map((t) => (
              <li key={t} className="flex gap-3"><CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-primary" /><span className="font-medium text-secondary">{t}</span></li>
            ))}
          </ul>
          <div className="mt-8 flex items-center gap-3 rounded-sm border border-border bg-card p-5">
            <ShieldCheck className="h-8 w-8 text-primary" />
            <p className="text-sm text-muted-foreground">Secure by design. Your code, your data, your IP — always.</p>
          </div>
        </div>
      </section>

      <section id="process" className="border-t border-border bg-muted py-24">
        <div className="mx-auto max-w-7xl px-6">
          <p className="font-mono text-sm font-medium text-primary">/ how we work</p>
          <h2 className="mt-3 max-w-2xl font-display text-4xl font-bold tracking-tight text-secondary md:text-5xl">A proven process, refined over {years} years.</h2>
          <div className="mt-14 grid gap-8 md:grid-cols-4">
            {process.map(([n, t, d]) => (
              <div key={n} className="border-t-2 border-primary pt-6">
                <span className="font-mono text-sm text-primary">{n}</span>
                <h3 className="mt-2 font-display text-2xl font-bold text-secondary">{t}</h3>
                <p className="mt-2 text-muted-foreground">{d}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section id="contact" className="mx-auto max-w-7xl px-6 py-24">
        <div className="relative overflow-hidden rounded-sm bg-gradient-primary p-10 text-primary-foreground shadow-elegant md:p-16">
          <div className="absolute inset-0 bg-grid opacity-10" />
          <div className="relative grid gap-10 lg:grid-cols-2 lg:items-center">
            <div>
              <h2 className="font-display text-4xl font-extrabold tracking-tight md:text-5xl">Got an idea? Let's build it.</h2>
              <p className="mt-4 text-lg text-primary-foreground/90">Tell us about your project and chat with us directly on WhatsApp.</p>
            </div>
            <div className="space-y-3">
              <button onClick={() => open()} className="flex w-full items-center gap-4 rounded-sm bg-card p-5 font-bold text-secondary transition-transform hover:-translate-y-0.5">
                <MessageCircle className="h-5 w-5 text-primary" /> Start a project on WhatsApp <ArrowRight className="ml-auto h-4 w-4" />
              </button>
              <a href="mailto:developers@codemathphp.co.za" className="flex items-center gap-4 rounded-sm bg-card/15 p-5 font-semibold backdrop-blur hover:bg-card/25">
                <Mail className="h-5 w-5" /> developers@codemathphp.co.za
              </a>
              <p className="flex items-center gap-4 rounded-sm bg-card/15 p-5 font-semibold"><MapPin className="h-5 w-5" /> Harare · Johannesburg</p>
            </div>
          </div>
        </div>
      </section>

      <footer className="border-t border-border">
        <div className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-4 px-6 py-10 md:flex-row">
          <img src={logo} alt="CodeMath" className="h-9 w-auto" />
          <p className="text-sm text-muted-foreground">© {new Date().getFullYear()} CodeMath. Building since 2009.</p>
        </div>
      </footer>
    </div>
  );
}
