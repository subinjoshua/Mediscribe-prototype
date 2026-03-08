import { useState, useEffect } from "react";
import { toast } from "sonner";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import ProcessTab from "./components/ProcessTab";
import ValidateTab from "./components/ValidateTab";
import OutbreakTab from "./components/OutbreakTab";
import DischargeTab from "./components/DischargeTab";
import { seedData } from "./api";

export default function MediScribeApp() {
  const [activeTab, setActiveTab] = useState("process");
  const [processedPatient, setProcessedPatient] = useState(null);
  const [outbreakAlert, setOutbreakAlert] = useState(null);
  const [isSeeded, setIsSeeded] = useState(false);
  const [seeding, setSeeding] = useState(false);
  const [now, setNow] = useState(new Date());

  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  const handleProcessingComplete = () => {
    toast.success("Patient data extracted! Click Validate to check prescriptions.");
  };

  const handlePatientProcessed = (patient) => {
    setProcessedPatient(patient);
    setActiveTab("validate");
  };

  const handleOutbreakAlert = (outbreakResult) => {
    if (outbreakResult?.status === "outbreak_detected") {
      setOutbreakAlert(outbreakResult.alert);
      setActiveTab("outbreak");
      const disease = outbreakResult.alert?.disease || "Unknown";
      toast.error(`OUTBREAK DETECTED \u2014 ${disease}`, { duration: Infinity });
    } else {
      toast.info("Patient saved. No outbreak detected.");
    }
  };

  const handleSeed = async () => {
    setSeeding(true);
    try {
      await seedData();
      setIsSeeded(true);
      toast.success("6 patients + 25 drugs loaded");
    } catch (err) {
      console.error("Seed failed:", err);
      toast.error("Seed failed: " + (err.message || "Unknown error"));
    } finally {
      setSeeding(false);
    }
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Top Bar */}
      <header className="bg-neutral-900 text-white shadow-md">
        <div className="max-w-7xl mx-auto px-4 py-3 flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">MediScribe</h1>
            <p className="text-neutral-400 text-sm">
              AI-Powered Clinical Documentation
            </p>
          </div>
          <div className="flex items-center gap-6">
            <div className="text-right">
              <p className="text-sm font-medium">Mumbai General Hospital</p>
              <p className="text-neutral-400 text-xs">
                {now.toLocaleDateString("en-IN", {
                  weekday: "short",
                  year: "numeric",
                  month: "short",
                  day: "numeric",
                })}
                {" \u2022 "}
                {now.toLocaleTimeString("en-IN", {
                  hour: "2-digit",
                  minute: "2-digit",
                  second: "2-digit",
                })}
              </p>
            </div>
            <Button
              variant={isSeeded ? "default" : "outline"}
              size="sm"
              onClick={handleSeed}
              disabled={isSeeded || seeding}
              className={
                isSeeded
                  ? "bg-green-600 hover:bg-green-600 text-white border-green-600"
                  : "border-neutral-500 text-neutral-200 hover:bg-neutral-700 hover:text-white"
              }
            >
              {isSeeded ? "\u2713 Seeded" : seeding ? "Seeding\u2026" : "Seed Demo Data"}
            </Button>
          </div>
        </div>
      </header>

      {/* Tabs Navigation + Content */}
      <div className="max-w-7xl mx-auto px-4 py-6">
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="grid w-full grid-cols-4 mb-6">
            <TabsTrigger value="process" className="gap-1.5">
              <span className="hidden sm:inline">&#128247;</span> Process
            </TabsTrigger>
            <TabsTrigger value="validate" className="gap-1.5">
              <span className="hidden sm:inline">&#128138;</span> Validate
            </TabsTrigger>
            <TabsTrigger value="outbreak" className="gap-1.5">
              <span className="hidden sm:inline">&#128680;</span> Outbreak
            </TabsTrigger>
            <TabsTrigger value="discharge" className="gap-1.5">
              <span className="hidden sm:inline">&#128203;</span> Discharge
            </TabsTrigger>
          </TabsList>

          <TabsContent value="process" className="tab-content">
            <ProcessTab
              onPatientProcessed={handlePatientProcessed}
              onOutbreakAlert={handleOutbreakAlert}
              onProcessingComplete={handleProcessingComplete}
            />
          </TabsContent>

          <TabsContent value="validate" className="tab-content">
            <ValidateTab
              processedPatient={processedPatient}
              onOutbreakAlert={handleOutbreakAlert}
            />
          </TabsContent>

          <TabsContent value="outbreak" className="tab-content">
            <OutbreakTab outbreakAlert={outbreakAlert} />
          </TabsContent>

          <TabsContent value="discharge" className="tab-content">
            <DischargeTab />
          </TabsContent>
        </Tabs>
      </div>

      {/* Footer */}
      <footer className="border-t bg-card mt-8">
        <div className="max-w-7xl mx-auto px-4 py-3 text-center text-xs text-muted-foreground">
          Built with Amazon Bedrock, Textract, DynamoDB, S3 | Team Helios
        </div>
      </footer>
    </div>
  );
}
