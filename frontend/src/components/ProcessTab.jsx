import { useState, useRef, useEffect, useCallback } from "react";
import { processPhoto, validatePrescription, checkOutbreak } from "../api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { AlertCircle, Loader2, Upload, ChevronRight } from "lucide-react";

function ConfidenceBadge({ value }) {
  const pct = Math.round(value * 100);
  const className =
    pct >= 90
      ? "bg-green-100 text-green-800 border-green-200"
      : pct >= 85
      ? "bg-yellow-100 text-yellow-800 border-yellow-200"
      : "bg-red-100 text-red-800 border-red-200";
  return (
    <Badge variant="outline" className={className}>
      {pct}%
    </Badge>
  );
}

export default function ProcessTab({
  processResult: result, setProcessResult: setResult,
  processImagePreview: imagePreview, setProcessImagePreview: setImagePreview,
  onPatientProcessed, onOutbreakAlert, onProcessingComplete,
}) {
  const [selectedImage, setSelectedImage] = useState(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [processingTime, setProcessingTime] = useState(0);
  const [error, setError] = useState(null);
  const [showRawOcr, setShowRawOcr] = useState(false);
  const [actionLoading, setActionLoading] = useState(null);

  const fileInputRef = useRef(null);
  const timerRef = useRef(null);
  const dropRef = useRef(null);

  useEffect(() => {
    if (isProcessing) {
      const start = Date.now();
      timerRef.current = setInterval(() => {
        setProcessingTime(((Date.now() - start) / 1000).toFixed(1));
      }, 100);
    } else if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [isProcessing]);

  const handleFile = useCallback((file) => {
    if (!file || !file.type.startsWith("image/")) return;
    setSelectedImage(file);
    setResult(null);
    setError(null);
    const reader = new FileReader();
    reader.onload = (e) => setImagePreview(e.target.result);
    reader.readAsDataURL(file);
  }, []);

  const handleDrop = useCallback(
    (e) => {
      e.preventDefault();
      e.stopPropagation();
      dropRef.current?.classList.remove("border-neutral-500", "bg-neutral-50");
      const file = e.dataTransfer?.files?.[0];
      if (file) handleFile(file);
    },
    [handleFile]
  );

  const handleDragOver = useCallback((e) => {
    e.preventDefault();
    e.stopPropagation();
    dropRef.current?.classList.add("border-neutral-500", "bg-neutral-50");
  }, []);

  const handleDragLeave = useCallback((e) => {
    e.preventDefault();
    e.stopPropagation();
    dropRef.current?.classList.remove("border-neutral-500", "bg-neutral-50");
  }, []);

  const handleProcess = async () => {
    if (!imagePreview) return;
    setIsProcessing(true);
    setError(null);
    setResult(null);
    try {
      const base64 = imagePreview.split(",")[1];
      const data = await processPhoto(base64);
      setResult(data);
      onProcessingComplete?.();
    } catch (err) {
      setError(err.message || "Processing failed");
    } finally {
      setIsProcessing(false);
    }
  };

  const handleValidate = async () => {
    if (!result) return;
    setActionLoading("validate");
    try {
      const patientContext = {
        age: result.patient?.age,
        gender: result.patient?.gender,
        diagnosis: result.diagnosis,
        allergies: result.patient?.allergies || [],
      };
      await validatePrescription(result.medications || [], patientContext);
      onPatientProcessed?.(result);
    } catch (err) {
      setError(err.message || "Validation failed");
    } finally {
      setActionLoading(null);
    }
  };

  const handleSaveAndCheckOutbreak = async () => {
    if (!result) return;
    setActionLoading("outbreak");
    try {
      const outbreakResult = await checkOutbreak(
        result.hospitalId || "mumbai-gen",
        result.diagnosis || ""
      );
      onOutbreakAlert?.(outbreakResult);
    } catch (err) {
      setError(err.message || "Outbreak check failed");
    } finally {
      setActionLoading(null);
    }
  };

  const patient = result?.patient;
  const vitals = result?.vitals;
  const diagnosis = result ? {
    chiefComplaint: result.chiefComplaint,
    diagnosis: result.diagnosis,
    icd10: result.icd10Code,
  } : null;
  const medications = result?.medications || [];
  const labs = result?.labsOrdered || result?.labs || [];
  const rawText = result?.rawOcrText || result?.rawText || result?.raw_text || "";

  return (
    <div className="flex gap-6">
      {/* LEFT SIDE - Upload */}
      <div className="w-2/5 space-y-4">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Upload className="h-5 w-5" /> Upload Prescription
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Drop zone */}
            <div
              ref={dropRef}
              onDrop={handleDrop}
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onClick={() => fileInputRef.current?.click()}
              className="border-2 border-dashed border-muted-foreground/25 rounded-lg p-8 text-center cursor-pointer hover:border-primary/50 transition-colors"
            >
              {imagePreview ? (
                <img
                  src={imagePreview}
                  alt="Prescription preview"
                  className="max-h-64 mx-auto rounded"
                />
              ) : (
                <div className="space-y-2">
                  <Upload className="h-10 w-10 mx-auto text-muted-foreground/40" />
                  <p className="text-muted-foreground font-medium">
                    Drop prescription image here
                  </p>
                  <p className="text-muted-foreground/60 text-sm">or click to select</p>
                </div>
              )}
            </div>

            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => handleFile(e.target.files?.[0])}
            />

            <Button
              onClick={handleProcess}
              disabled={(!selectedImage && !imagePreview) || isProcessing}
              className="w-full"
              size="lg"
            >
              {isProcessing && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {isProcessing ? "Processing..." : "Process Prescription"}
            </Button>

            {/* Processing state */}
            {isProcessing && (
              <div className="text-center space-y-2">
                <p className="text-sm font-medium text-primary">{processingTime}s elapsed</p>
                <Badge variant="secondary" className="bg-neutral-100 text-neutral-700 border-neutral-200">
                  {parseFloat(processingTime) < 2
                    ? "Analyzing with AWS Textract..."
                    : "Extracting with Amazon Bedrock (Claude)..."}
                </Badge>
              </div>
            )}

            {/* Completion */}
            {result && !isProcessing && (
              <p className="text-sm text-green-600 font-medium text-center">
                Processed in {processingTime} seconds (manual entry takes ~15 minutes)
              </p>
            )}

            {error && (
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}
          </CardContent>
        </Card>
      </div>

      {/* RIGHT SIDE - Results */}
      <div className="w-3/5 space-y-4">
        {!result && !isProcessing && (
          <Card className="p-12 text-center">
            <CardContent className="pt-0">
              <div className="text-5xl mb-4 text-muted-foreground/30">&#128196;</div>
              <p className="font-medium text-muted-foreground">
                Upload and process a prescription to see extracted data
              </p>
            </CardContent>
          </Card>
        )}

        {/* Skeleton loading */}
        {isProcessing && (
          <div className="space-y-4">
            <Card>
              <CardContent className="p-5 space-y-3">
                <div className="skeleton h-4 w-32" />
                <div className="skeleton h-6 w-48" />
                <div className="skeleton h-4 w-36" />
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-5 space-y-3">
                <div className="skeleton h-4 w-20" />
                <div className="grid grid-cols-4 gap-4">
                  <div className="skeleton h-12" />
                  <div className="skeleton h-12" />
                  <div className="skeleton h-12" />
                  <div className="skeleton h-12" />
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-5 space-y-3">
                <div className="skeleton h-4 w-24" />
                <div className="skeleton h-5 w-64" />
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-5 space-y-3">
                <div className="skeleton h-4 w-28" />
                <div className="skeleton h-8 w-full" />
                <div className="skeleton h-8 w-full" />
                <div className="skeleton h-8 w-full" />
              </CardContent>
            </Card>
          </div>
        )}

        {result && (
          <>
            {/* Patient Card */}
            {patient && (
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">
                    Patient Information
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="flex items-center gap-4">
                    <div>
                      <p className="text-lg font-semibold">
                        {patient.name}{" "}
                        {patient.confidence != null && (
                          <ConfidenceBadge value={patient.confidence} />
                        )}
                      </p>
                      <p className="text-muted-foreground">
                        {patient.age && `${patient.age} yrs`}
                        {patient.gender && ` \u2022 ${patient.gender}`}
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Vitals Card */}
            {vitals && (
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">
                    Vitals
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                    {[
                      { label: "BP", value: vitals.bloodPressure },
                      { label: "HR", value: vitals.heartRate },
                      { label: "Temp", value: vitals.temperature },
                      { label: "SpO2", value: vitals.spO2 },
                    ].map(
                      (v) =>
                        v.value != null && (
                          <div key={v.label} className="text-center p-3 bg-muted/50 rounded-lg">
                            <p className="text-xs text-muted-foreground uppercase">{v.label}</p>
                            <p className="text-lg font-semibold">{v.value}</p>
                            {vitals[`${v.label.toLowerCase()}_confidence`] != null && (
                              <ConfidenceBadge
                                value={vitals[`${v.label.toLowerCase()}_confidence`]}
                              />
                            )}
                          </div>
                        )
                    )}
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Diagnosis Card */}
            {diagnosis && (
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">
                    Diagnosis
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {diagnosis.chiefComplaint && (
                    <p className="text-muted-foreground mb-1">
                      <span className="font-medium">Chief Complaint:</span>{" "}
                      {diagnosis.chiefComplaint}
                    </p>
                  )}
                  <p className="font-semibold">
                    {diagnosis.diagnosis}
                    {diagnosis.icd10 && (
                      <Badge variant="secondary" className="ml-2">
                        {diagnosis.icd10}
                      </Badge>
                    )}
                  </p>
                </CardContent>
              </Card>
            )}

            {/* Medications Table */}
            {medications.length > 0 && (
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">
                    Medications
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Drug Name</TableHead>
                        <TableHead>Dosage</TableHead>
                        <TableHead>Unit</TableHead>
                        <TableHead>Frequency</TableHead>
                        <TableHead>Confidence</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {medications.map((med, i) => {
                        const lowConf = med.confidence != null && med.confidence < 0.85;
                        const badUnit =
                          med.unit &&
                          /^(ml|milliliter)/i.test(med.unit) &&
                          med.form &&
                          /tablet|capsule/i.test(med.form);
                        return (
                          <TableRow key={i} className={lowConf ? "bg-yellow-50" : ""}>
                            <TableCell className="font-medium">
                              {med.name || med.drug}
                            </TableCell>
                            <TableCell>{med.dosage}</TableCell>
                            <TableCell className={badUnit ? "text-red-600 font-semibold" : ""}>
                              {med.unit}
                            </TableCell>
                            <TableCell>{med.frequency}</TableCell>
                            <TableCell>
                              {med.confidence != null && (
                                <ConfidenceBadge value={med.confidence} />
                              )}
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            )}

            {/* Labs Ordered */}
            {labs.length > 0 && (
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">
                    Labs Ordered
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <ul className="list-disc list-inside text-sm space-y-1">
                    {labs.map((lab, i) => (
                      <li key={i}>{typeof lab === "string" ? lab : lab.name}</li>
                    ))}
                  </ul>
                </CardContent>
              </Card>
            )}

            {/* Raw OCR Text */}
            {rawText && (
              <Card>
                <CardContent className="p-5">
                  <button
                    onClick={() => setShowRawOcr(!showRawOcr)}
                    className="flex items-center gap-2 text-sm font-semibold text-muted-foreground uppercase tracking-wider w-full"
                  >
                    <ChevronRight
                      className={`h-4 w-4 transition-transform ${showRawOcr ? "rotate-90" : ""}`}
                    />
                    Raw OCR Text
                  </button>
                  {showRawOcr && (
                    <pre className="mt-3 p-4 bg-muted rounded-md text-xs whitespace-pre-wrap font-mono max-h-64 overflow-y-auto">
                      {rawText}
                    </pre>
                  )}
                </CardContent>
              </Card>
            )}

            {/* Action Buttons */}
            <div className="flex gap-3">
              <Button
                onClick={handleValidate}
                disabled={actionLoading != null}
                className="flex-1 bg-neutral-800 hover:bg-neutral-900"
                size="lg"
              >
                {actionLoading === "validate" && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {actionLoading === "validate" ? "Validating..." : "Validate Prescription"}
              </Button>
              <Button
                onClick={handleSaveAndCheckOutbreak}
                disabled={actionLoading != null}
                className="flex-1 bg-neutral-700 hover:bg-neutral-800"
                size="lg"
              >
                {actionLoading === "outbreak" && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {actionLoading === "outbreak" ? "Checking..." : "Save & Check Outbreak"}
              </Button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
