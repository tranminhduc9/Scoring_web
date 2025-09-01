import { Switch, Route } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/not-found";
import ClusteringPage from "@/pages/clustering";
import MockTestPage from "@/pages/mock-test";
import IndustryMapPage from "@/pages/industry-map";

function Router() {
  return (
    <Switch>
      <Route path="/" component={ClusteringPage} />
      <Route path="/mock-test" component={MockTestPage} />
      <Route path="/industry-map" component={IndustryMapPage} />
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Toaster />
        <Router />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
