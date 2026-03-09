import { useState, useRef, useEffect } from "react";
import { generateDischargeSummary, getPatients } from "../api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertTitle, AlertDescription } from "@/components/ui/alert";
import { Separator } from "@/components/ui/separator";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Loader2, CheckCircle2, AlertCircle, AlertTriangle, Printer, Pencil, RefreshCw } from "lucide-react";

function InfoItem({ label, value }) {
  return (
    <div>
      <p className="text-xs text-muted-foreground uppercase tracking-wider">{label}</p>
      <p className="text-sm font-medium">{value}</p>
    </div>
  );
}

function InstructionBlock({ label, text }) {
  return (
    <div>
      <p className="text-sm font-semibold text-yellow-800">{label}</p>
      <p className="text-sm text-yellow-900 mt-1 whitespace-pre-line">{text}</p>
    </div>
  );
}

export default function DischargeTab({ processedPatients = [] }) {
  const [patients, setPatients] = useState([]);
  const [selectedPatientId, setSelectedPatientId] = useState("");
  const [isGenerating, setIsGenerating] = useState(false);
  const [isLoadingPatients, setIsLoadingPatients] = useState(true);
  const [generationTime, setGenerationTime] = useState(null);
  const [summary, setSummary] = useState(null);
  const [elapsedTime, setElapsedTime] = useState(0);
  const [error, setError] = useState(null);

  const timerRef = useRef(null);

  // Fetch patients from DynamoDB on mount
  useEffect(() => {
    const fetchPatients = async () => {
      setIsLoadingPatients(true);
      try {
        const data = await getPatients();
        const fetched = (data.patients || []).map((p) => ({
          patientId: p.patientId,
          name: p.name || "Unknown",
          age: p.age,
          gender: p.gender,
          diagnosis: p.latestDiagnosis || "—",
        }));
        setPatients(fetched);
        if (fetched.length > 0 && !selectedPatientId) {
          setSelectedPatientId(fetched[0].patientId);
        }
      } catch (err) {
        console.error("Failed to fetch patients:", err);
      } finally {
        setIsLoadingPatients(false);
      }
    };
    fetchPatients();
  }, []);

  // Merge session-processed patients into the list
  const allPatients = [...patients];
  for (const pp of processedPatients) {
    if (!allPatients.some((p) => p.patientId === pp.patientId)) {
      allPatients.push({
        patientId: pp.patientId,
        encounterId: pp.encounterId,
        name: pp.patient?.name || "Unknown",
        age: pp.patient?.age,
        gender: pp.patient?.gender,
        diagnosis: pp.diagnosis || "—",
      });
    }
  }

  // Auto-select first patient if none selected
  useEffect(() => {
    if (!selectedPatientId && allPatients.length > 0) {
      setSelectedPatientId(allPatients[0].patientId);
    }
  }, [allPatients.length]);

  useEffect(() => {
    if (isGenerating) {
      const start = Date.now();
      timerRef.current = setInterval(() => {
        setElapsedTime(Date.now() - start);
      }, 100);
    } else if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [isGenerating]);

  const patient = allPatients.find((p) => p.patientId === selectedPatientId);

  // Find encounterId — session-processed patients have it directly
  const getEncounterId = () => {
    const sessionPatient = processedPatients.find((p) => p.patientId === selectedPatientId);
    return sessionPatient?.encounterId || patient?.encounterId || selectedPatientId;
  };

  const handleGenerate = async () => {
    if (!patient) return;
    setIsGenerating(true);
    setError(null);
    setSummary(null);
    setGenerationTime(null);
    setElapsedTime(0);
    try {
      const data = await generateDischargeSummary(patient.patientId, getEncounterId());
      setGenerationTime(data.generationTimeMs);
      setSummary(data.summary);
    } catch (err) {
      setError(err.message || "Failed to generate discharge summary");
    } finally {
      setIsGenerating(false);
    }
  };

  const handleRefresh = async () => {
    setIsLoadingPatients(true);
    try {
      const data = await getPatients();
      const fetched = (data.patients || []).map((p) => ({
        patientId: p.patientId,
        name: p.name || "Unknown",
        age: p.age,
        gender: p.gender,
        diagnosis: p.latestDiagnosis || "—",
      }));
      setPatients(fetched);
    } catch (err) {
      console.error("Failed to fetch patients:", err);
    } finally {
      setIsLoadingPatients(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Patient Selector */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>Select Patient for Discharge</CardTitle>
            <Button
              variant="outline"
              size="sm"
              onClick={handleRefresh}
              disabled={isLoadingPatients}
            >
              <RefreshCw className={`h-4 w-4 mr-1 ${isLoadingPatients ? "animate-spin" : ""}`} />
              Refresh
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {allPatients.length === 0 && !isLoadingPatients ? (
            <p className="text-center text-muted-foreground py-4">
              No patients found. Process a prescription first or seed demo data.
            </p>
          ) : (
            <select
              value={selectedPatientId}
              onChange={(e) => {
                setSelectedPatientId(e.target.value);
                setSummary(null);
                setGenerationTime(null);
                setError(null);
              }}
              className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
            >
              {allPatients.map((p) => (
                <option key={p.patientId} value={p.patientId}>
                  {p.name} &mdash; {p.diagnosis}
                </option>
              ))}
            </select>
          )}

          {patient && (
            <div className="bg-muted/50 rounded-lg p-4 grid grid-cols-2 sm:grid-cols-4 gap-4">
              <InfoItem label="Name" value={patient.name} />
              <InfoItem label="Age / Gender" value={`${patient.age || "—"}${patient.gender ? `, ${patient.gender}` : ""}`} />
              <InfoItem label="Diagnosis" value={patient.diagnosis} />
              <InfoItem label="Patient ID" value={patient.patientId?.slice(0, 8) + "..."} />
            </div>
          )}
        </CardContent>
      </Card>

      {/* Generate Button */}
      <Button
        onClick={handleGenerate}
        disabled={isGenerating || !patient}
        className="w-full text-lg py-6 bg-neutral-800 hover:bg-neutral-900"
        size="lg"
      >
        {isGenerating && <Loader2 className="mr-2 h-5 w-5 animate-spin" />}
        {isGenerating ? "Generating..." : "Generate Discharge Summary"}
      </Button>

      {/* Generating State */}
      {isGenerating && (
        <div className="space-y-4">
          <Card className="p-8 text-center">
            <CardContent className="pt-0">
              <Loader2 className="h-8 w-8 text-neutral-600 mx-auto mb-4 animate-spin" />
              <p className="font-medium text-lg">Generating with Amazon Bedrock...</p>
              <p className="text-neutral-600 text-2xl font-bold mt-2">
                {(elapsedTime / 1000).toFixed(1)} seconds...
              </p>
              <Badge variant="secondary" className="mt-3 bg-neutral-100 text-neutral-700 border-neutral-200">
                Processing with Amazon Bedrock + DynamoDB...
              </Badge>
            </CardContent>
          </Card>
          <Card className="p-8 space-y-6">
            <div className="text-center space-y-2">
              <div className="skeleton h-6 w-64 mx-auto" />
              <div className="skeleton h-4 w-40 mx-auto" />
            </div>
            <div className="skeleton h-4 w-32" />
            <div className="grid grid-cols-3 gap-3">
              <div className="skeleton h-10" />
              <div className="skeleton h-10" />
              <div className="skeleton h-10" />
            </div>
            <div className="skeleton h-4 w-32" />
            <div className="skeleton h-20 w-full" />
            <div className="skeleton h-4 w-32" />
            <div className="skeleton h-24 w-full" />
          </Card>
        </div>
      )}

      {/* Timer Result */}
      {summary && !isGenerating && (
        <Alert className="bg-green-50 border-green-200">
          <CheckCircle2 className="h-4 w-4 text-green-600" />
          <AlertTitle className="text-green-800 text-lg font-semibold">
            Generated in {(generationTime / 1000).toFixed(1)} seconds | Normally takes 45 minutes
          </AlertTitle>
        </Alert>
      )}

      {/* Error */}
      {error && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {/* Discharge Summary Document */}
      {summary && (
        <Card className="shadow-lg">
          <CardContent className="p-8">
            {/* Hospital Header */}
            <div className="bg-neutral-900 text-white text-center rounded-t-lg -mx-8 -mt-8 px-8 py-5 mb-6">
              <h1 className="text-xl font-bold uppercase tracking-wide">
                Mumbai General Hospital
              </h1>
              <p className="text-neutral-400 text-sm mt-1 font-semibold uppercase tracking-wider">
                Discharge Summary
              </p>
            </div>

            {/* Patient Demographics */}
            <div>
              <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-3">
                Patient Demographics
              </h3>
              <div className="bg-muted/50 rounded-lg p-4 grid grid-cols-2 sm:grid-cols-3 gap-3">
                <InfoItem label="Name" value={summary.demographics?.name} />
                <InfoItem label="Age" value={summary.demographics?.age} />
                <InfoItem label="Gender" value={summary.demographics?.gender} />
                <InfoItem label="MRN" value={summary.demographics?.mrn} />
                <InfoItem label="Blood Group" value={summary.demographics?.bloodGroup} />
                {summary.demographics?.abhaNumber && (
                  <InfoItem label="ABHA Number" value={summary.demographics.abhaNumber} />
                )}
              </div>
            </div>

            <Separator className="my-6" />

            {/* Admission Details */}
            <div>
              <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-3">
                Admission Details
              </h3>
              <div className="bg-muted/50 rounded-lg p-4 grid grid-cols-2 sm:grid-cols-3 gap-3">
                <InfoItem label="Admission Date" value={summary.admissionDetails?.admissionDate} />
                <InfoItem label="Discharge Date" value={summary.admissionDetails?.dischargeDate} />
                <InfoItem label="Length of Stay" value={`${summary.admissionDetails?.lengthOfStay} days`} />
                <InfoItem label="Admitting Diagnosis" value={summary.admissionDetails?.admittingDiagnosis} />
                <InfoItem label="Attending Physician" value={summary.admissionDetails?.attendingPhysician} />
              </div>
            </div>

            <Separator className="my-6" />

            {/* Hospital Course */}
            <div>
              <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-3">
                Hospital Course
              </h3>
              <div className="text-sm leading-relaxed whitespace-pre-line">
                {summary.hospitalCourse}
              </div>
            </div>

            <Separator className="my-6" />

            {/* Diagnoses Table */}
            <div>
              <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-3">
                Diagnoses
              </h3>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Type</TableHead>
                    <TableHead>Condition</TableHead>
                    <TableHead>ICD-10 Code</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {summary.diagnoses?.map((dx, i) => (
                    <TableRow key={i}>
                      <TableCell>
                        {dx.type === "Primary" ? (
                          <Badge className="bg-neutral-200 text-neutral-800 border-neutral-300">
                            {dx.type}
                          </Badge>
                        ) : (
                          <span className="text-muted-foreground">{dx.type}</span>
                        )}
                      </TableCell>
                      <TableCell>{dx.condition}</TableCell>
                      <TableCell className="font-mono text-xs text-muted-foreground">{dx.icd10}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>

            <Separator className="my-6" />

            {/* Significant Findings */}
            <div>
              <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-3">
                Significant Findings
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                {summary.significantFindings?.labs?.length > 0 && (
                  <div>
                    <h4 className="text-xs font-semibold text-muted-foreground uppercase mb-2">Labs</h4>
                    <ul className="list-disc list-inside text-sm space-y-1">
                      {summary.significantFindings.labs.map((item, i) => <li key={i}>{item}</li>)}
                    </ul>
                  </div>
                )}
                {summary.significantFindings?.imaging?.length > 0 && (
                  <div>
                    <h4 className="text-xs font-semibold text-muted-foreground uppercase mb-2">Imaging</h4>
                    <ul className="list-disc list-inside text-sm space-y-1">
                      {summary.significantFindings.imaging.map((item, i) => <li key={i}>{item}</li>)}
                    </ul>
                  </div>
                )}
                {summary.significantFindings?.procedures?.length > 0 && (
                  <div>
                    <h4 className="text-xs font-semibold text-muted-foreground uppercase mb-2">Procedures</h4>
                    <ul className="list-disc list-inside text-sm space-y-1">
                      {summary.significantFindings.procedures.map((item, i) => <li key={i}>{item}</li>)}
                    </ul>
                  </div>
                )}
              </div>
            </div>

            <Separator className="my-6" />

            {/* Medications on Discharge */}
            <div>
              <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-3">
                Medications on Discharge
              </h3>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Drug</TableHead>
                    <TableHead>Dosage</TableHead>
                    <TableHead>Frequency</TableHead>
                    <TableHead>Duration</TableHead>
                    <TableHead>Indication</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {summary.medicationsOnDischarge?.map((med, i) => (
                    <TableRow key={i}>
                      <TableCell className="font-medium">{med.name}</TableCell>
                      <TableCell>{med.dosage}</TableCell>
                      <TableCell>{med.frequency}</TableCell>
                      <TableCell>{med.duration}</TableCell>
                      <TableCell className="text-xs text-muted-foreground">{med.indication}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>

            <Separator className="my-6" />

            {/* Follow-Up Plan */}
            <div>
              <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-3">
                Follow-Up Plan
              </h3>
              <div className="space-y-3">
                {summary.followUp?.appointments?.map((appt, i) => (
                  <div key={i} className="flex items-start gap-3 p-3 bg-muted/50 rounded-lg">
                    <span className="text-lg">&#128197;</span>
                    <div>
                      <p className="text-sm font-medium">
                        {appt.specialty} &mdash; {appt.when}
                      </p>
                      <p className="text-xs text-muted-foreground">{appt.purpose}</p>
                    </div>
                  </div>
                ))}
                {summary.followUp?.investigations?.length > 0 && (
                  <div>
                    <h4 className="text-xs font-semibold text-muted-foreground uppercase mb-2">
                      Investigations
                    </h4>
                    <ul className="list-disc list-inside text-sm space-y-1">
                      {summary.followUp.investigations.map((inv, i) => <li key={i}>{inv}</li>)}
                    </ul>
                  </div>
                )}
              </div>
            </div>

            <Separator className="my-6" />

            {/* Patient Instructions */}
            <div>
              <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-3">
                Patient Instructions
              </h3>
              <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 space-y-3">
                {summary.patientInstructions?.medications && (
                  <InstructionBlock label="Medications" text={summary.patientInstructions.medications} />
                )}
                {summary.patientInstructions?.diet && (
                  <InstructionBlock label="Diet" text={summary.patientInstructions.diet} />
                )}
                {summary.patientInstructions?.activity && (
                  <InstructionBlock label="Activity" text={summary.patientInstructions.activity} />
                )}
              </div>
            </div>

            {/* RED FLAGS */}
            {summary.patientInstructions?.redFlags && (
              <>
                <Separator className="my-6" />
                <Alert variant="destructive" className="border-2 border-l-4">
                  <AlertTriangle className="h-5 w-5" />
                  <AlertTitle className="text-base font-bold uppercase">
                    Red Flags &mdash; Return to Hospital Immediately If:
                  </AlertTitle>
                  <AlertDescription className="text-sm font-medium whitespace-pre-line mt-1">
                    {summary.patientInstructions.redFlags}
                  </AlertDescription>
                </Alert>
              </>
            )}

            {/* Document Footer */}
            <Separator className="my-6" />
            <div className="flex items-center justify-between text-sm text-muted-foreground">
              <p>Generated by MediScribe AI | Reviewed by: Dr. Priya Sharma</p>
              <div className="flex gap-2">
                <Button variant="outline" size="sm">
                  <Printer className="mr-2 h-4 w-4" /> Print
                </Button>
                <Button variant="outline" size="sm">
                  <Pencil className="mr-2 h-4 w-4" /> Edit
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
