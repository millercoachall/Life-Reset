import React from "react";
import { createRoot } from "react-dom/client";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { analytics } from "@heycatch/sdk";
import App from "./App";
import "./theme.css";

// HeyCatch analytics — init once at the client entry point (module scope).
// Autocapture covers pageviews, clicks, and SPA route changes from here on.
analytics.init({
  projectKey: "hck_pk_3pieM5kzlaP-KwKZMaGD56tCNZ7cumHR",
  install: { framework: "react", frameworkVersion: "19", agent: "other" },
});

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { retry: 1, staleTime: 10_000 },
  },
});

createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <QueryClientProvider client={queryClient}>
      <App />
    </QueryClientProvider>
  </React.StrictMode>
);
