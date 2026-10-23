import { createContext, useContext, useState, type FormEvent, type ReactNode } from "react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { MessageCircle } from "lucide-react";
import { SERVICE_OPTIONS, buildWhatsAppUrl } from "@/lib/whatsapp";

type Ctx = { open: (service?: string) => void };
const ProjectCtx = createContext<Ctx>({ open: () => {} });
export const useProjectDialog = () => useContext(ProjectCtx);

const field =
  "h-10 w-full rounded-sm border border-input bg-card px-3 text-sm text-foreground outline-none transition-colors focus:border-primary focus:ring-2 focus:ring-primary/20";

export function ProjectDialogProvider({ children }: { children: ReactNode }) {
  const [isOpen, setOpen] = useState(false);
  const [service, setService] = useState("");
  const [name, setName] = useState("");
  const [company, setCompany] = useState("");
  const [error, setError] = useState("");

  const open = (s?: string) => {
    setService(s ?? "");
    setError("");
    setOpen(true);
  };

  const submit = (ev: FormEvent) => {
    ev.preventDefault();
    if (!name.trim() || name.length > 100) return setError("Please enter your name.");
    if (!company.trim() || company.length > 120) return setError("Please enter your company name.");
    if (!service) return setError("Please select a service.");
    window.open(buildWhatsAppUrl({ name, company, service }), "_blank", "noopener");
    setOpen(false);
  };

  return (
    <ProjectCtx.Provider value={{ open }}>
      {children}
      <Dialog open={isOpen} onOpenChange={setOpen}>
        <DialogContent className="max-w-md gap-0 rounded-sm border-t-4 border-t-primary p-7">
          <DialogHeader className="text-left">
            <DialogTitle className="font-display text-2xl font-bold text-secondary">
              You Think It. We Build It.
            </DialogTitle>
            <DialogDescription>Tell us what you need, and let's bring your vision to life.</DialogDescription>
          </DialogHeader>
          <form onSubmit={submit} className="mt-5 space-y-4">
            <label className="block text-sm font-semibold text-secondary">
              Your Name *
              <input className={`${field} mt-1.5`} value={name} maxLength={100} onChange={(e) => setName(e.target.value)} />
            </label>
            <label className="block text-sm font-semibold text-secondary">
              Company Name *
              <input className={`${field} mt-1.5`} value={company} maxLength={120} onChange={(e) => setCompany(e.target.value)} />
            </label>
            <label className="block text-sm font-semibold text-secondary">
              Service Required *
              <select className={`${field} mt-1.5`} value={service} onChange={(e) => setService(e.target.value)}>
                <option value="">Select a service</option>
                {SERVICE_OPTIONS.map((s) => (
                  <option key={s} value={s}>{s}</option>
                ))}
              </select>
            </label>
            <p className="border-l-4 border-primary bg-accent px-4 py-3 text-xs text-accent-foreground">
              <strong>Important:</strong> Clients are expected to be ready to commence payment as the project kicks off.
            </p>
            {error && <p className="text-sm font-medium text-destructive">{error}</p>}
            <button
              type="submit"
              className="flex h-11 w-full items-center justify-center gap-2 rounded-sm bg-gradient-primary font-bold text-primary-foreground shadow-elegant transition-transform hover:-translate-y-0.5"
            >
              <MessageCircle className="h-4 w-4" /> Start Chat on WhatsApp
            </button>
          </form>
        </DialogContent>
      </Dialog>
    </ProjectCtx.Provider>
  );
}
