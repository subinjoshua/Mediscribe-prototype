import { useState, useEffect } from "react";
import AlertCard from "./AlertCard";
import { validatePrescription } from "../api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Loader2, CheckCircle2, AlertCircle, User } from "lucide-react";

export default function ValidateTab({ processedPatient, onOutbreakAlert }) {
  const [validationResult, setValidationResult] = useState(null);
  const [isValidating, setIsValidating] = useState(false);
  const [corrections, setCorrections] = useState({});
  const [error, setError] = useState(null);

  const [manualForm, setManualForm] = useState({
    drugName: "",
    dosage: "",
    unit: "mg",
    frequency: "BD",
    patientAge: "",
    allergies: "",
    diagnosis: "",
  });

  useEffect(() => {
    if (processedPatient?.medications?.length > 0) {
      runValidation(processedPatient.medications, {
        age: processedPatient.patient?.age,
        gender: processedPatient.patient?.gender,
        diagnosis: processedPatient.diagnosis,
        allergies: processedPatient.patient?.allergies || [],
      });
    }
  }, [processedPatient]);

  const runValidation = async (medications, patientContext) => {
    setIsValidating(true);
    setError(null);
    setValidationResult(null);
    setCorrections({});
    try {
      const result = await validatePrescription(medications, patientContext);
      setValidationResult(result);
    } catch (err) {
      setError(err.message || "Validation failed");
    } finally {
      setIsValidating(false);
    }
  };

  const handleManualValidate = () => {
    const medications = [
      {
        name: manualForm.drugName,
        dosage: manualForm.dosage,
        unit: manualForm.unit,
        frequency: manualForm.frequency,
      },
    ];
    const patientContext = {
      age: parseInt(manualForm.patientAge, 10) || 30,
      allergies: manualForm.allergies
        ? manualForm.allergies.split(",").map((a) => a.trim())
        : [],
      diagnosis: manualForm.diagnosis,
    };
    runValidation(medications, patientContext);
  };

  const handleApplyCorrection = (drug, correctedValue) => {
    setCorrections((prev) => ({ ...prev, [drug]: correctedValue }));
  };

  const patient = processedPatient?.patient;
  const diagnosis = processedPatient?.diagnosis; // string from backend

  const allAlerts = validationResult
    ? [
        ...(validationResult.errors || []),
        ...(validationResult.warnings || []),
        ...(validationResult.info || []),
      ]
    : [];

  const errorCount = validationResult?.errors?.length || 0;
  const warningCount = validationResult?.warnings?.length || 0;
  const infoCount = validationResult?.info?.length || 0;

  return (
    <div className="space-y-4">
      {/* Patient context bar */}
      {patient && (
        <Card>
          <CardContent className="px-5 py-3 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <User className="h-5 w-5 text-muted-foreground" />
              <span className="font-medium">
                Patient: {patient.name},{" "}
                {patient.age && `${patient.age}`}
                {patient.gender && patient.gender.charAt(0).toUpperCase()}
              </span>
              {diagnosis && (
                <span className="text-muted-foreground">
                  | Diagnosis: {diagnosis}
                </span>
              )}
            </div>
            {validationResult && (
              <div className="flex items-center gap-3">
                {errorCount > 0 && (
                  <Badge variant="destructive">
                    {errorCount} error{errorCount !== 1 && "s"}
                  </Badge>
                )}
                {warningCount > 0 && (
                  <Badge className="bg-amber-100 text-amber-800 border-amber-200">
                    {warningCount} warning{warningCount !== 1 && "s"}
                  </Badge>
                )}
                {infoCount > 0 && (
                  <Badge variant="secondary" className="bg-neutral-100 text-neutral-600 border-neutral-200">
                    {infoCount} info
                  </Badge>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Validating state */}
      {isValidating && (
        <div className="space-y-4">
          <Card className="p-8 text-center">
            <CardContent className="pt-0">
              <Loader2 className="h-8 w-8 text-neutral-600 mx-auto mb-3 animate-spin" />
              <p className="text-muted-foreground font-medium mb-2">
                Validating medications...
              </p>
              <Badge variant="secondary" className="bg-neutral-100 text-neutral-700 border-neutral-200">
                Checking with Amazon Bedrock + Drug Safety DB...
              </Badge>
            </CardContent>
          </Card>
          <div className="space-y-3">
            <Card><CardContent className="p-4"><div className="skeleton h-5 w-full" /></CardContent></Card>
            <Card><CardContent className="p-4 space-y-3"><div className="skeleton h-4 w-48" /><div className="skeleton h-12 w-full" /></CardContent></Card>
            <Card><CardContent className="p-4 space-y-3"><div className="skeleton h-4 w-48" /><div className="skeleton h-12 w-full" /></CardContent></Card>
          </div>
        </div>
      )}

      {/* Error */}
      {error && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {/* Validation results */}
      {validationResult && !isValidating && (
        <div className="space-y-3">
          {/* Overall status banner */}
          <Alert
            variant={validationResult.validationResult === "errors_found" ? "destructive" : "default"}
            className={
              validationResult.validationResult === "approved"
                ? "bg-green-50 border-green-200 text-green-800"
                : validationResult.validationResult === "errors_found"
                ? "bg-red-50"
                : "bg-amber-50 border-amber-200 text-amber-800"
            }
          >
            {validationResult.validationResult === "approved" ? (
              <CheckCircle2 className="h-4 w-4 text-green-600" />
            ) : (
              <AlertCircle className="h-4 w-4" />
            )}
            <AlertTitle className="text-center font-semibold">
              {validationResult.validationResult === "approved"
                ? "All medications validated successfully"
                : validationResult.validationResult === "errors_found"
                ? `${errorCount} critical issue${errorCount !== 1 ? "s" : ""} found \u2014 review required`
                : `${warningCount} warning${warningCount !== 1 ? "s" : ""} found \u2014 please review`}
            </AlertTitle>
          </Alert>

          {/* Alert cards */}
          <div className="space-y-0">
            {allAlerts.map((alert, i) => {
              const corrected = corrections[alert.drug];
              return (
                <AlertCard
                  key={i}
                  severity={alert.severity}
                  type={alert.type}
                  title={`${alert.type?.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase())} \u2014 ${alert.drug}`}
                  message={alert.message}
                  details={
                    alert.type === "unit"
                      ? {
                          prescribed: alert.message.match(/unit is '([^']+)'/)?.[1],
                          recommended: alert.message.match(/should be '([^']+)'/)?.[1],
                          safeRange: alert.message.match(/dispensed in (.+)/)?.[1],
                        }
                      : undefined
                  }
                  onAction={
                    alert.severity === "critical" && !corrected
                      ? () => handleApplyCorrection(alert.drug, "corrected")
                      : undefined
                  }
                  actionLabel={
                    corrected
                      ? undefined
                      : alert.severity === "critical"
                      ? "Apply Correction"
                      : undefined
                  }
                />
              );
            })}
          </div>

          {/* Applied corrections */}
          {Object.keys(corrections).length > 0 && (
            <Alert className="bg-green-50 border-green-200">
              <CheckCircle2 className="h-4 w-4 text-green-600" />
              <AlertTitle className="text-green-800">Applied Corrections</AlertTitle>
              <AlertDescription>
                <ul className="text-sm text-green-700 space-y-1 mt-1">
                  {Object.entries(corrections).map(([drug]) => (
                    <li key={drug}>Correction applied for {drug}</li>
                  ))}
                </ul>
              </AlertDescription>
            </Alert>
          )}
        </div>
      )}

      {/* Manual entry */}
      {!processedPatient && !isValidating && !validationResult && (
        <Card>
          <CardHeader>
            <CardTitle className="text-center text-muted-foreground font-medium text-base">
              Process a prescription first in the Process tab, or enter medications manually below
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-5">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium mb-1">Drug Name</label>
                <Input
                  value={manualForm.drugName}
                  onChange={(e) => setManualForm({ ...manualForm, drugName: e.target.value })}
                  placeholder="e.g. Paracetamol"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Dosage</label>
                <Input
                  value={manualForm.dosage}
                  onChange={(e) => setManualForm({ ...manualForm, dosage: e.target.value })}
                  placeholder="e.g. 500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Unit</label>
                <select
                  value={manualForm.unit}
                  onChange={(e) => setManualForm({ ...manualForm, unit: e.target.value })}
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                >
                  <option value="mg">mg</option>
                  <option value="ml">ml</option>
                  <option value="mcg">mcg</option>
                  <option value="g">g</option>
                  <option value="IU">IU</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Frequency</label>
                <select
                  value={manualForm.frequency}
                  onChange={(e) => setManualForm({ ...manualForm, frequency: e.target.value })}
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                >
                  <option value="OD">Once daily (OD)</option>
                  <option value="BD">Twice daily (BD)</option>
                  <option value="TID">Three times daily (TID)</option>
                  <option value="QID">Four times daily (QID)</option>
                  <option value="STAT">Immediately (STAT)</option>
                  <option value="PRN">As needed (PRN)</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Patient Age</label>
                <Input
                  type="number"
                  value={manualForm.patientAge}
                  onChange={(e) => setManualForm({ ...manualForm, patientAge: e.target.value })}
                  placeholder="e.g. 28"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Allergies</label>
                <Input
                  value={manualForm.allergies}
                  onChange={(e) => setManualForm({ ...manualForm, allergies: e.target.value })}
                  placeholder="e.g. Penicillin, Sulfa"
                />
              </div>
              <div className="col-span-2">
                <label className="block text-sm font-medium mb-1">Diagnosis</label>
                <Input
                  value={manualForm.diagnosis}
                  onChange={(e) => setManualForm({ ...manualForm, diagnosis: e.target.value })}
                  placeholder="e.g. Dengue Fever"
                />
              </div>
            </div>

            <Button
              onClick={handleManualValidate}
              disabled={!manualForm.drugName || !manualForm.dosage}
              className="w-full bg-neutral-800 hover:bg-neutral-900"
              size="lg"
            >
              Validate Medication
            </Button>
          </CardContent>
        </Card>
      )}

      <p className="text-center text-xs text-muted-foreground pt-2">
        Validation powered by Amazon Bedrock (Claude Sonnet 4.6) + drug safety database
      </p>
    </div>
  );
}
