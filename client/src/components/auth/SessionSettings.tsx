import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Laptop, LogOut, RefreshCw, ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { authClient } from "@/lib/auth-client";

const sessionsKey = ["auth", "sessions"] as const;

export function SessionSettings() {
  const queryClient = useQueryClient();
  const currentSession = authClient.useSession();
  const sessions = useQuery({
    queryKey: sessionsKey,
    queryFn: async () => {
      const { data, error } = await authClient.listSessions();
      if (error) throw new Error("Could not load your sessions.");
      return data;
    },
    // Session tokens are used only for revocation and never persisted or logged.
    gcTime: 0,
  });
  const revoke = useMutation({
    mutationFn: async (token: string | null) => {
      const result = token ? await authClient.revokeSession({ token }) : await authClient.revokeOtherSessions();
      if (result.error) throw new Error("Could not sign out this session. Please try again.");
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: sessionsKey });
      toast.success("Session access revoked.");
    },
    onError: () => toast.error("Could not sign out this session. Please try again."),
  });
  const currentToken = currentSession.data?.session.token;
  const otherSessions = sessions.data?.filter((session) => session.token !== currentToken) ?? [];

  return (
    <Card className="mt-6 shadow-sm">
      <CardHeader className="gap-3 sm:flex sm:flex-row sm:items-start sm:justify-between">
        <div className="space-y-1.5">
          <CardTitle className="flex items-center gap-2">
            <ShieldCheck aria-hidden="true" className="size-5 text-primary" />
            Active sessions
          </CardTitle>
          <CardDescription>See where you’re signed in and revoke access to other devices.</CardDescription>
        </div>
        <Button
          disabled={!currentToken || otherSessions.length === 0 || revoke.isPending}
          onClick={() => revoke.mutate(null)}
          size="sm"
          variant="outline"
        >
          <LogOut aria-hidden="true" className="size-4" />
          Sign out other devices
        </Button>
      </CardHeader>
      <CardContent>
        {sessions.isPending ? (
          <p role="status" className="text-sm text-muted-foreground">
            Loading sessions…
          </p>
        ) : null}
        {sessions.isError ? (
          <div className="flex flex-wrap items-center gap-3" role="alert">
            <p className="text-sm text-muted-foreground">Could not load your sessions.</p>
            <Button onClick={() => void sessions.refetch()} size="sm" variant="outline">
              <RefreshCw aria-hidden="true" className="size-4" /> Try again
            </Button>
          </div>
        ) : null}
        <ul className="divide-y">
          {sessions.data?.map((session) => {
            const isCurrent = session.token === currentToken;
            return (
              <li className="flex items-center gap-3 py-4 first:pt-0 last:pb-0" key={session.id}>
                <div className="rounded-xl border bg-muted/40 p-2.5">
                  <Laptop aria-hidden="true" className="size-5 text-muted-foreground" />
                </div>
                <div className="min-w-0 flex-1 space-y-1">
                  <div className="flex flex-wrap items-center gap-2 text-sm font-medium">
                    {isCurrent ? "This device" : "Other device"}
                    {isCurrent ? <Badge variant="secondary">Current</Badge> : null}
                  </div>
                  <p className="truncate text-xs text-muted-foreground" title={session.userAgent ?? undefined}>
                    {session.userAgent || "Browser information unavailable"}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Signed in {new Date(session.createdAt).toLocaleString()}
                  </p>
                </div>
                {!isCurrent ? (
                  <Button
                    aria-label={`Sign out session from ${new Date(session.createdAt).toLocaleString()}`}
                    disabled={!currentToken || revoke.isPending}
                    onClick={() => revoke.mutate(session.token)}
                    size="sm"
                    variant="ghost"
                  >
                    Sign out
                  </Button>
                ) : null}
              </li>
            );
          })}
        </ul>
      </CardContent>
    </Card>
  );
}
