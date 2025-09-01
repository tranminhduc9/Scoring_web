import { useEffect } from "react";
import IndustryScatterPlot from "@/components/industry-scatter-plot";
import { Button } from "@/components/ui/button";
import { Link } from "wouter";
import { ArrowLeft } from "lucide-react";

export default function IndustryMapPage() {
  useEffect(() => {
    document.title = "Industry Sector Map - Enterprise Analytics Platform";
  }, []);

  return (
    <div className="min-h-screen bg-background p-6">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-foreground mb-2">
              Industry Sector Map
            </h1>
            <p className="text-muted-foreground">
              Interactive visualization of industry sectors based on embedded characteristics
            </p>
          </div>
          <Link href="/">
            <Button variant="outline" className="flex items-center gap-2" data-testid="button-back-to-main">
              <ArrowLeft className="h-4 w-4" />
              Back to Main
            </Button>
          </Link>
        </div>

        {/* Industry Scatter Plot */}
        <IndustryScatterPlot height={700} />
      </div>
    </div>
  );
}