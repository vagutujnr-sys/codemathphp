import { createFileRoute } from "@tanstack/react-router";
import {
  ArrowRight,
  Code2,
  Smartphone,
  LayoutDashboard,
  Palette,
  Server,
  ShieldCheck,
  Globe2,
  Sparkles,
  CheckCircle2,
  Mail,
  Phone,
  MapPin,
} from "lucide-react";
import logo from "@/assets/codemath-logo.png.asset.json";
import heroImg from "@/assets/hero-team.jpg";
import meetingImg from "@/assets/client-meeting.jpg";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "CodeMath — African Dev House Since 2009 | Web, App & Systems" },
      {
        name: "description",
        content:
          "CodeMath builds world-class websites, mobile apps and business systems for Zimbabwe, South Africa and beyond. Trusted since 2009 across 7 countries.",
      },
      { property: "og:title", content: "CodeMath — You Think It. We Build It." },
      {
        property: "og:description",
        content: "Premium software development from Africa. Websites, apps, dashboards and systems since 2009.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Index,
});

const services = [
  { icon: Globe2, title: "Websites", text: "High-converting, lightning-fast websites that rank and sell." },
  { icon: Code2, title: "Web Applications", text: "Custom platforms, portals and SaaS built to scale with your business." },
  { icon: Smartphone, title: "Mobile Apps", text: "Native-feel Android & iOS apps your customers will love using." },
  { icon: LayoutDashboard, title: "Dashboards & Systems", text: "ERP, POS, HR and reporting systems that remove friction." },
  { icon: Server, title: "Cloud & Hosting", text: "Secure hosting, integrations, payments and APIs that just work." },
  { icon: Palette, title: "Brand & UI Design", text: "Interfaces and identities that make your business look world-class." },
];

const countries = [
  { name: "Zimbabwe", flag: "🇿🇼" },
  { name: "South Africa", flag: "🇿🇦" },
  { name: "Botswana", flag: "🇧🇼" },
  { name: "Zambia", flag: "🇿🇲" },
  { name: "Namibia", flag: "🇳🇦" },
  { name: "United Kingdom", flag: "🇬🇧" },
  { name: "United States", flag: "🇺🇸" },
  { name: "Cayman Islands", flag: "🇰🇾" },
];

const work = [
  { name: "Isimilo Investments", tag: "Logistics Website", text: "Cross-border cargo brand with quote requests and live enquiries." },
  { name: "Betadeck", tag: "SaaS Platform", text: "White-label client panels for hosting providers." },
  { name: "Hustle Creations", tag: "E-learning & Shop", text: "Online courses, product sales and bookings in one place." },
];

const process = [
  { n: "01", t: "Discover", d: "We unpack your goals, customers and numbers." },
  { n: "02", t: "Design", d: "Clickable prototypes before a single line of code." },
  { n: "03", t: "Build", d: "Agile sprints with weekly demos you can test." },
  { n: "04", t: "Launch & Grow", d: "Go live, measure, support and keep improving." },
];

function Index() {
  const years = new Date().getFullYear() - 2009;
  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* Nav */}
      <header className="sticky top-0 z-50 border-b border-border/70 bg-background/85 backdrop-blur">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-4">
          <a href="#top" aria-label="CodeMath home">
            <img src={logo.url} alt="CodeMath — You Think It. We Built It." className="h-11 w-auto" />
          </a>
          <nav className="hidden items-center gap-8 text-sm font-semibold md:flex">
            <a href="#services" className="hover:text-primary">Services</a>
            <a href="#work" className="hover:text-primary">Work</a>
            <a href="#process" className="hover:text-primary">Process</a>
            <a href="#about" className="hover:text-primary">About</a>
          </nav>
          <a
            href="#contact"
            className="rounded-full bg-gradient-primary px-5 py-2.5 text-sm font-bold text-primary-foreground shadow-elegant transition-transform hover:-translate-y-0.5"
          >
            Start a Project
          </a>
        </div>
      </header>

      {/* Hero */}
      <section id="top" className="relative overflow-hidden">
        <div className="absolute inset-0 bg-grid opacity-50 [mask-image:radial-gradient(ellipse_at_top_left,black,transparent_70%)]" />
        <div className="absolute inset-0 bg-gradient-warm" />
        <div className="relative mx-auto grid max-w-7xl items-center gap-14 px-6 pb-24 pt-16 lg:grid-cols-2 lg:pt-24">
          <div className="animate-rise">
            <span className="inline-flex items-center gap-2 rounded-full border border-primary/30 bg-accent px-4 py-1.5 font-mono text-xs font-medium text-accent-foreground">
              <Sparkles className="h-3.5 w-3.5" /> Proudly African · Building since 2009
            </span>
            <h1 className="mt-6 font-display text-5xl font-extrabold leading-[1.05] tracking-tight text-secondary md:text-6xl lg:text-7xl">
              You think it.
              <br />
              <span className="bg-gradient-primary bg-clip-text text-transparent">We build it.</span>
            </h1>
            <p className="mt-6 max-w-xl text-lg leading-relaxed text-muted-foreground">
              CodeMath is a Zimbabwean & South African dev house crafting websites, mobile apps and
              business systems that help ambitious African companies compete with the world.
            </p>
            <div className="mt-9 flex flex-wrap gap-4">
              <a
                href="#contact"
                className="group inline-flex items-center gap-2 rounded-full bg-gradient-primary px-7 py-4 font-bold text-primary-foreground shadow-elegant transition-transform hover:-translate-y-0.5"
              >
                Start your project <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
              </a>
              <a
                href="#work"
                className="inline-flex items-center gap-2 rounded-full border-2 border-secondary px-7 py-4 font-bold text-secondary transition-colors hover:bg-secondary hover:text-secondary-foreground"
              >
                See our work
              </a>
            </div>
            <dl className="mt-12 grid max-w-lg grid-cols-3 gap-6 border-t border-border pt-8">
              {[
                [`${years}+`, "Years building"],
                ["7", "Countries served"],
                ["300+", "Projects shipped"],
              ].map(([v, l]) => (
                <div key={l}>
                  <dt className="font-display text-3xl font-extrabold text-secondary">{v}</dt>
                  <dd className="mt-1 text-sm text-muted-foreground">{l}</dd>
                </div>
              ))}
            </dl>
          </div>

          <div className="relative animate-rise [animation-delay:150ms]">
            <div className="absolute -inset-4 rotate-2 rounded-[2rem] bg-gradient-primary opacity-90" />
            <img
              src={heroImg}
              alt="CodeMath developers collaborating in the studio"
              width={1536}
              height={1152}
              className="relative aspect-[4/3] w-full rounded-[1.75rem] object-cover shadow-card"
            />
            <div className="absolute -bottom-8 -left-6 rounded-2xl border border-border bg-card p-5 shadow-card">
              <pre className="font-mono text-xs leading-relaxed text-muted-foreground">
                <span className="text-primary">const</span> client = <span className="text-secondary">"you"</span>;{"\n"}
                <span className="text-primary">await</span> codemath.build(idea);{"\n"}
                <span className="text-chart-3">// ✓ shipped, scaled, loved</span>
              </pre>
            </div>
          </div>
        </div>
      </section>

      {/* Countries marquee */}
      <section className="border-y border-border bg-card py-6">
        <div className="mx-auto max-w-7xl px-6">
          <p className="mb-4 text-center font-mono text-xs uppercase tracking-[0.25em] text-muted-foreground">
            Trusted by clients across
          </p>
          <div className="overflow-hidden [mask-image:linear-gradient(90deg,transparent,black_10%,black_90%,transparent)]">
            <div className="flex w-max animate-marquee gap-12">
              {[...countries, ...countries].map((c, i) => (
                <span key={i} className="flex items-center gap-3 whitespace-nowrap font-display text-lg font-semibold text-secondary">
                  <span className="text-2xl">{c.flag}</span> {c.name}
                </span>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Services */}
      <section id="services" className="mx-auto max-w-7xl px-6 py-28">
        <div className="max-w-2xl">
          <p className="font-mono text-sm font-medium text-primary">/ what we build</p>
          <h2 className="mt-3 font-display text-4xl font-bold tracking-tight text-secondary md:text-5xl">
            Full-stack capability, under one roof.
          </h2>
          <p className="mt-4 text-lg text-muted-foreground">
            From a first landing page to enterprise systems — strategy, design, engineering and support.
          </p>
        </div>
        <div className="mt-14 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {services.map(({ icon: Icon, title, text }) => (
            <div
              key={title}
              className="group rounded-2xl border border-border bg-card p-8 transition-all hover:-translate-y-1 hover:border-primary/40 hover:shadow-elegant"
            >
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-accent text-primary transition-colors group-hover:bg-gradient-primary group-hover:text-primary-foreground">
                <Icon className="h-6 w-6" />
              </div>
              <h3 className="mt-6 font-display text-xl font-bold text-secondary">{title}</h3>
              <p className="mt-2 text-muted-foreground">{text}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Work */}
      <section id="work" className="bg-muted py-28">
        <div className="mx-auto max-w-7xl px-6">
          <div className="flex flex-wrap items-end justify-between gap-6">
            <div>
              <p className="font-mono text-sm font-medium text-primary">/ selected work</p>
              <h2 className="mt-3 font-display text-4xl font-bold tracking-tight text-secondary md:text-5xl">
                Outcomes, not just pretty pages.
              </h2>
            </div>
            <a href="#contact" className="inline-flex items-center gap-2 font-bold text-primary">
              Discuss your project <ArrowRight className="h-4 w-4" />
            </a>
          </div>
          <div className="mt-14 grid gap-6 md:grid-cols-3">
            {work.map((w, i) => (
              <article key={w.name} className="overflow-hidden rounded-2xl border border-border bg-card shadow-card">
                <div className="relative flex aspect-[4/3] items-end bg-secondary p-6">
                  <div className="absolute inset-0 bg-grid opacity-10" />
                  <span className="absolute right-5 top-5 font-display text-6xl font-extrabold text-primary/30">0{i + 1}</span>
                  <span className="relative rounded-full bg-gradient-primary px-3 py-1 text-xs font-bold text-primary-foreground">
                    {w.tag}
                  </span>
                </div>
                <div className="p-6">
                  <h3 className="font-display text-xl font-bold text-secondary">{w.name}</h3>
                  <p className="mt-2 text-muted-foreground">{w.text}</p>
                </div>
              </article>
            ))}
          </div>
        </div>
      </section>

      {/* About */}
      <section id="about" className="mx-auto grid max-w-7xl items-center gap-16 px-6 py-28 lg:grid-cols-2">
        <div className="relative">
          <img
            src={meetingImg}
            alt="A CodeMath developer reviewing an app with a client"
            width={1200}
            height={1408}
            loading="lazy"
            className="aspect-[4/5] w-full rounded-[1.75rem] object-cover shadow-card"
          />
          <div className="absolute -right-4 top-10 rounded-2xl bg-gradient-primary p-6 text-primary-foreground shadow-elegant md:-right-8">
            <p className="font-display text-5xl font-extrabold">2009</p>
            <p className="text-sm font-semibold">Building Africa's digital future</p>
          </div>
        </div>
        <div>
          <p className="font-mono text-sm font-medium text-primary">/ about codemath</p>
          <h2 className="mt-3 font-display text-4xl font-bold tracking-tight text-secondary md:text-5xl">
            African talent. Global standards.
          </h2>
          <p className="mt-6 text-lg leading-relaxed text-muted-foreground">
            For over {years} years we've partnered with businesses from Harare to Johannesburg, Gaborone
            to George Town. We understand local markets — mobile money, patchy data, multi-currency — and
            we build software that performs where your customers actually are.
          </p>
          <ul className="mt-8 space-y-4">
            {[
              "Local payment integrations: EcoCash, PayFast, Paynow, Stripe & more",
              "Fast, data-light experiences built for African networks",
              "Dedicated project manager and transparent weekly progress",
              "Ongoing support, hosting and maintenance after launch",
            ].map((t) => (
              <li key={t} className="flex gap-3">
                <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-primary" />
                <span className="font-medium text-secondary">{t}</span>
              </li>
            ))}
          </ul>
          <div className="mt-8 flex items-center gap-3 rounded-2xl border border-border bg-card p-5">
            <ShieldCheck className="h-8 w-8 text-primary" />
            <p className="text-sm text-muted-foreground">
              Secure by design. Your code, your data, your IP — always.
            </p>
          </div>
        </div>
      </section>

      {/* Process */}
      <section id="process" className="bg-secondary py-28 text-secondary-foreground">
        <div className="mx-auto max-w-7xl px-6">
          <p className="font-mono text-sm font-medium text-primary-glow">/ how we work</p>
          <h2 className="mt-3 max-w-2xl font-display text-4xl font-bold tracking-tight md:text-5xl">
            A proven process, refined over {years} years.
          </h2>
          <div className="mt-14 grid gap-8 md:grid-cols-4">
            {process.map((p) => (
              <div key={p.n} className="border-t-2 border-primary pt-6">
                <span className="font-mono text-sm text-primary-glow">{p.n}</span>
                <h3 className="mt-2 font-display text-2xl font-bold">{p.t}</h3>
                <p className="mt-2 text-secondary-foreground/70">{p.d}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA / Contact */}
      <section id="contact" className="mx-auto max-w-7xl px-6 py-28">
        <div className="relative overflow-hidden rounded-[2rem] bg-gradient-primary p-10 text-primary-foreground shadow-elegant md:p-16">
          <div className="absolute inset-0 bg-grid opacity-10" />
          <div className="relative grid gap-10 lg:grid-cols-2 lg:items-center">
            <div>
              <h2 className="font-display text-4xl font-extrabold tracking-tight md:text-5xl">
                Got an idea? Let's build it.
              </h2>
              <p className="mt-4 text-lg text-primary-foreground/90">
                Tell us about your project and get a free consultation and quote within 24 hours.
              </p>
            </div>
            <div className="space-y-4">
              {[
                { icon: Mail, label: "hello@codemathphp.co.za", href: "mailto:hello@codemathphp.co.za" },
                { icon: Phone, label: "WhatsApp us", href: "https://wa.me/" },
                { icon: MapPin, label: "Harare · Johannesburg", href: "#" },
              ].map(({ icon: Icon, label, href }) => (
                <a
                  key={label}
                  href={href}
                  className="flex items-center gap-4 rounded-2xl bg-card/15 p-5 font-semibold backdrop-blur transition-colors hover:bg-card/25"
                >
                  <Icon className="h-5 w-5" /> {label}
                </a>
              ))}
            </div>
          </div>
        </div>
      </section>

      <footer className="border-t border-border">
        <div className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-4 px-6 py-10 md:flex-row">
          <img src={logo.url} alt="CodeMath" className="h-9 w-auto" />
          <p className="text-sm text-muted-foreground">
            © {new Date().getFullYear()} CodeMath. Building since 2009.
          </p>
        </div>
      </footer>
    </div>
  );
}
