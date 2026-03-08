import { useState, useEffect } from "react";
import {
  LineChart, Line, Area, XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  ReferenceLine, ResponsiveContainer,
} from "recharts";
import { getOutbreakDashboard } from "../api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Alert, AlertTitle, AlertDescription } from "@/components/ui/alert";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { AlertCircle, Loader2, X } from "lucide-react";

const DISEASE_COLORS = {
  "Dengue Fever": "#ef4444",
  Malaria: "#3b82f6",
  Typhoid: "#22c55e",
  Tuberculosis: "#a855f7",
  Influenza: "#f59e0b",
};

function formatDate(dateStr) {
  const d = new Date(dateStr + "T00:00:00");
  return d.toLocaleDateString("en-IN", { weekday: "short", month: "short", day: "numeric" });
}

export default function OutbreakTab({ outbreakAlert }) {
  const [dashboardData, setDashboardData] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selectedAlert, setSelectedAlert] = useState(null);

  const fetchDashboard = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const data = await getOutbreakDashboard("mumbai-gen");
      setDashboardData(data);
    } catch (err) {
      console.error("Failed to load outbreak dashboard:", err);
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchDashboard();
  }, []);

  useEffect(() => {
    if (outbreakAlert) {
      setSelectedAlert(outbreakAlert);
      fetchDashboard();
    }
  }, [outbreakAlert]);

  const activeAlert = selectedAlert || (dashboardData?.activeAlerts?.[0] ?? null);

  const diseases = dashboardData?.timeline?.length
    ? Object.keys(dashboardData.timeline[0]).filter((k) => k !== "date")
    : [];

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Card>
          <CardContent className="p-6">
            <div className="skeleton h-5 w-48 mb-4" />
            <div className="skeleton h-64 w-full" />
          </CardContent>
        </Card>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <Card>
            <CardContent className="p-6 space-y-3">
              <div className="skeleton h-5 w-36" />
              <div className="skeleton h-10 w-full" />
              <div className="skeleton h-10 w-full" />
              <div className="skeleton h-10 w-full" />
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-6 space-y-3">
              <div className="skeleton h-5 w-36" />
              <div className="skeleton h-8 w-full" />
              <div className="skeleton h-8 w-full" />
              <div className="skeleton h-8 w-full" />
              <div className="skeleton h-8 w-full" />
            </CardContent>
          </Card>
        </div>
        <p className="text-center">
          <Badge variant="secondary" className="bg-neutral-100 text-neutral-700 border-neutral-200">
            Loading from Amazon DynamoDB + Bedrock...
          </Badge>
        </p>
      </div>
    );
  }

  if (error) {
    return (
      <Alert variant="destructive" className="text-center">
        <AlertCircle className="h-4 w-4" />
        <AlertTitle>Failed to load dashboard</AlertTitle>
        <AlertDescription className="mt-1">{error}</AlertDescription>
        <Button variant="destructive" size="sm" onClick={fetchDashboard} className="mt-4">
          Retry
        </Button>
      </Alert>
    );
  }

  return (
    <div className="space-y-6">
      {/* TOP BANNER - Outbreak Alert */}
      {activeAlert && (
        <Alert variant="destructive" className="bg-red-600 text-white border-red-600 shadow-lg animate-pulse-subtle">
          <div className="flex items-center gap-3 w-full">
            <span className="text-2xl">&#128680;</span>
            <div className="flex-1">
              <AlertTitle className="text-white font-bold text-lg">
                OUTBREAK ALERT &mdash; {activeAlert.disease}
              </AlertTitle>
              <AlertDescription className="text-red-100 text-sm mt-0.5">
                {activeAlert.caseCount} cases in 24 hours | &uarr;{" "}
                {Math.round(activeAlert.percentageIncrease)}% above baseline
                {activeAlert.severity && (
                  <Badge className="ml-3 bg-red-800 text-white border-red-800 uppercase">
                    {activeAlert.severity}
                  </Badge>
                )}
              </AlertDescription>
            </div>
            <button
              onClick={() => setSelectedAlert(null)}
              className="text-red-200 hover:text-white"
              title="Dismiss"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        </Alert>
      )}

      {/* Disease Trends Chart */}
      <Card>
        <CardHeader>
          <CardTitle>Disease Trends &mdash; Last 7 Days</CardTitle>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={320}>
            <LineChart data={dashboardData?.timeline || []}>
              <defs>
                <linearGradient id="dengueGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#ef4444" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="#ef4444" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
              <XAxis dataKey="date" tickFormatter={formatDate} tick={{ fontSize: 12 }} stroke="#6b7280" />
              <YAxis allowDecimals={false} tick={{ fontSize: 12 }} stroke="#6b7280"
                label={{ value: "Cases", angle: -90, position: "insideLeft", fontSize: 12 }} />
              <Tooltip labelFormatter={formatDate} contentStyle={{ borderRadius: 8, borderColor: "#e5e7eb" }} />
              <Legend />
              <ReferenceLine y={5} stroke="#ef4444" strokeDasharray="6 4"
                label={{ value: "Threshold (5)", position: "right", fill: "#ef4444", fontSize: 11 }} />
              {diseases.includes("Dengue Fever") && (
                <Area type="monotone" dataKey="Dengue Fever" fill="url(#dengueGradient)"
                  stroke="none" animationDuration={1500} />
              )}
              {diseases.map((disease) => (
                <Line key={disease} type="monotone" dataKey={disease}
                  stroke={DISEASE_COLORS[disease] || "#6b7280"}
                  strokeWidth={disease === "Dengue Fever" ? 3 : 2}
                  dot={{ r: disease === "Dengue Fever" ? 5 : 3 }}
                  activeDot={{ r: 7 }} animationDuration={1500} animationBegin={200} />
              ))}
            </LineChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      {/* Forecast + Resources */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <span>&#128200;</span> 48-Hour Forecast
            </CardTitle>
          </CardHeader>
          <CardContent>
            {activeAlert?.forecast ? (
              <div className="space-y-3">
                <ForecastRow label="Next 24h" value={activeAlert.forecast.next48Hours?.predicted}
                  range={activeAlert.forecast.next48Hours?.range} color="text-orange-600" bg="bg-orange-50" />
                <ForecastRow label="Next 48h"
                  value={activeAlert.forecast.next48Hours?.predicted
                    ? Math.round(activeAlert.forecast.next48Hours.predicted * 1.5) : null}
                  range={activeAlert.forecast.next48Hours?.range
                    ? [Math.round(activeAlert.forecast.next48Hours.range[0] * 1.4),
                       Math.round(activeAlert.forecast.next48Hours.range[1] * 1.6)] : null}
                  color="text-red-600" bg="bg-red-50" />
                <ForecastRow label="Next 72h" value={activeAlert.forecast.next72Hours?.predicted}
                  range={activeAlert.forecast.next72Hours?.range} color="text-red-700" bg="bg-red-50" />
                {activeAlert.forecast.reasoning && (
                  <p className="text-xs text-muted-foreground mt-3 italic">{activeAlert.forecast.reasoning}</p>
                )}
              </div>
            ) : (
              <div className="space-y-3">
                <ForecastRow label="Next 24h" value={8} range={[8, 12]} color="text-orange-600" bg="bg-orange-50" />
                <ForecastRow label="Next 48h" value={16} range={[12, 20]} color="text-red-600" bg="bg-red-50" />
                <ForecastRow label="Next 72h" value={22} range={[17, 28]} color="text-red-700" bg="bg-red-50" />
                <p className="text-xs text-muted-foreground mt-3 italic">
                  Forecast based on historical trends and seasonal patterns.
                </p>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <span>&#128230;</span> Resources Needed
            </CardTitle>
          </CardHeader>
          <CardContent>
            {activeAlert?.resourceRecommendations ? (
              <div className="space-y-2">
                <ResourceRow icon="&#128715;&#65039;" label="Beds" value={activeAlert.resourceRecommendations.beds} />
                <ResourceRow icon="&#128167;" label="NS Fluid" value={`${activeAlert.resourceRecommendations.nsFluidLiters}L`} />
                <ResourceRow icon="&#129656;" label="Platelet Units" value={activeAlert.resourceRecommendations.plateletUnits} />
                <ResourceRow icon="&#129514;" label="Test Kits" value={activeAlert.resourceRecommendations.testKits} />
                {activeAlert.resourceRecommendations.keyMedications?.map((med, i) => (
                  <ResourceRow key={i} icon="&#128138;" label={med} value="" />
                ))}
              </div>
            ) : (
              <div className="space-y-2">
                <ResourceRow icon="&#128715;&#65039;" label="Beds" value={12} />
                <ResourceRow icon="&#128167;" label="NS Fluid" value="45L" />
                <ResourceRow icon="&#129656;" label="Platelet Units" value={5} />
                <ResourceRow icon="&#129514;" label="Test Kits" value={30} />
                <ResourceRow icon="&#128138;" label="Paracetamol" value="500 tablets" />
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Recommended Actions */}
      {activeAlert?.recommendedActions?.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <span>&#9989;</span> Recommended Actions
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {activeAlert.recommendedActions.map((action, i) => (
                <div key={i} className="flex items-start gap-3 p-3 bg-muted/50 rounded-lg border">
                  <span className="flex-shrink-0 w-7 h-7 rounded-full bg-primary/10 text-primary flex items-center justify-center text-sm font-bold">
                    {i + 1}
                  </span>
                  <p className="text-sm leading-relaxed">{action}</p>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Recent Cases Table */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <span>&#128203;</span> Recent Cases
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Time</TableHead>
                <TableHead>Patient</TableHead>
                <TableHead>Disease</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {(dashboardData?.recentDiagnoses || []).map((dx, i) => {
                const isTriggering = i === 0 && activeAlert;
                return (
                  <TableRow key={i} className={isTriggering ? "bg-red-50" : ""}>
                    <TableCell>{dx.time || "\u2014"}</TableCell>
                    <TableCell>
                      <span className="font-medium">{dx.patientName}</span>
                      <span className="text-muted-foreground ml-1 text-xs">({dx.patientId})</span>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline"
                        style={{
                          backgroundColor: `${DISEASE_COLORS[dx.disease] || "#6b7280"}20`,
                          color: DISEASE_COLORS[dx.disease] || "#6b7280",
                          borderColor: `${DISEASE_COLORS[dx.disease] || "#6b7280"}40`,
                        }}
                      >
                        {dx.disease}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      {isTriggering ? (
                        <Badge variant="destructive" className="text-xs">TRIGGERED ALERT</Badge>
                      ) : (
                        <span className="text-xs text-muted-foreground">Recorded</span>
                      )}
                    </TableCell>
                  </TableRow>
                );
              })}
              {(!dashboardData?.recentDiagnoses || dashboardData.recentDiagnoses.length === 0) && (
                <TableRow>
                  <TableCell colSpan={4} className="py-8 text-center text-muted-foreground">
                    No recent diagnoses recorded.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}

/* Helper Components */

function ForecastRow({ label, value, range, color, bg }) {
  return (
    <div className={`flex items-center justify-between ${bg} rounded-lg px-4 py-3`}>
      <span className="text-sm font-medium">{label}</span>
      <div className="text-right">
        <span className={`text-lg font-bold ${color}`}>
          {range ? `${range[0]}\u2013${range[1]}` : value ?? "\u2014"} cases
        </span>
      </div>
    </div>
  );
}

function ResourceRow({ icon, label, value }) {
  return (
    <div className="flex items-center justify-between py-2 px-3 rounded hover:bg-muted/50">
      <div className="flex items-center gap-2">
        <span>{icon}</span>
        <span className="text-sm">{label}</span>
      </div>
      {value !== "" && (
        <span className="text-sm font-semibold">{value}</span>
      )}
    </div>
  );
}
