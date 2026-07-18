import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";
import { Check, Sparkles } from "lucide-react";
import { BrandMark } from "@/components/ui/brand-mark";
import { redirectSearchValidator } from "@/lib/router-search";
import { Route as IndexRoute } from "@/routes/index";

export const Route = createFileRoute("/(auth)/_auth")({
  validateSearch: redirectSearchValidator,
  beforeLoad: ({ context: { auth }, search }) => {
    if (auth.isAuthenticated) {
      const redirectTo = search.redirect || IndexRoute.to;
      throw redirect({ to: redirectTo });
    }
  },
  component: AuthLayout,
});

function AuthLayout() {
  const highlights = ["Typed streaming responses", "Approval-gated tools", "Secure conversation history"];

  return (
    <div className="min-h-dvh bg-background">
      <div className="flex min-h-dvh">
        <section className="relative hidden w-[48%] overflow-hidden border-r bg-gradient-to-br from-violet-500/[0.08] via-background to-cyan-500/[0.08] lg:flex lg:flex-col lg:justify-center lg:px-12 xl:px-20">
          <div className="-top-28 -left-28 absolute size-80 rounded-full bg-violet-500/15 blur-3xl" />
          <div className="-right-28 -bottom-28 absolute size-96 rounded-full bg-cyan-500/15 blur-3xl" />

          <div className="relative mx-auto max-w-lg">
            <div className="mb-10 flex items-center gap-3">
              <BrandMark className="size-11 rounded-2xl" />
              <h1 className="text-xl font-semibold tracking-tight">ChatFlow</h1>
            </div>

            <div className="space-y-7">
              <div className="inline-flex items-center gap-2 rounded-full border bg-background/70 px-3 py-1.5 text-sm shadow-sm backdrop-blur">
                <Sparkles aria-hidden="true" className="size-4 text-violet-500" />
                Built for focused AI work
              </div>
              <h2 className="text-balance font-bold text-4xl leading-tight tracking-tight xl:text-5xl">
                One workspace for questions, tools, and decisions.
              </h2>
              <p className="max-w-md text-lg leading-relaxed text-muted-foreground">
                Move from a rough idea to a clear, grounded next step without losing the context that got you there.
              </p>
              <div className="grid gap-3">
                {highlights.map((highlight) => (
                  <div className="flex items-center gap-3" key={highlight}>
                    <span className="flex size-6 items-center justify-center rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
                      <Check aria-hidden="true" className="size-3.5" />
                    </span>
                    <span className="font-medium">{highlight}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>

        <main className="relative flex flex-1 flex-col justify-center overflow-hidden bg-background/80 px-4 py-12 backdrop-blur sm:px-6 lg:px-14 xl:px-20">
          <div className="-top-24 -right-24 absolute size-72 rounded-full bg-violet-500/10 blur-3xl lg:hidden" />
          <div className="relative mx-auto w-full max-w-md">
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  );
}
