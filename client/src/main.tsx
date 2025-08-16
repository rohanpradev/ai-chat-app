import { QueryClient } from "@tanstack/react-query";
import { createRouter, RouterProvider } from "@tanstack/react-router";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { ThemeProvider } from "@/components/theme-provider";
import { LoadingSpinner } from "@/components/ui/loading";
import { createAuthContext, loadUser } from "@/lib/auth";
import { routeTree } from "@/routeTree.gen";
import "./styles.css";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 5 * 60 * 1000,
      gcTime: 10 * 60 * 1000,
      retry: 1,
    },
  },
});

const auth = createAuthContext(queryClient);

const router = createRouter({
  routeTree,
  context: {
    auth,
    queryClient,
  },
});

declare module "@tanstack/react-router" {
  interface Register {
    router: typeof router;
  }
}

const rootElement = document.getElementById("root");
if (!rootElement) throw new Error("Root element not found");

const root = createRoot(rootElement);

// Show loading spinner initially
root.render(
  <StrictMode>
    <LoadingSpinner />
  </StrictMode>,
);

// Load user on app start
loadUser(queryClient, auth).finally(() => {
  root.render(
    <StrictMode>
      <ThemeProvider defaultTheme="system" storageKey="chat-app-theme">
        <RouterProvider router={router} />
      </ThemeProvider>
    </StrictMode>,
  );
});
