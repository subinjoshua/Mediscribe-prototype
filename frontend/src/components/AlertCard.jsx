import { Alert, AlertTitle, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { AlertCircle, AlertTriangle, Info, CheckCircle2 } from "lucide-react";

const SEVERITY_CONFIG = {
  critical: {
    className: "border-l-4 border-l-red-500 bg-red-50",
    icon: AlertCircle,
    titleClass: "text-red-800",
    textClass: "text-red-700",
    badgeClass: "bg-red-100 text-red-800 border-red-200",
    buttonVariant: "destructive",
  },
  warning: {
    className: "border-l-4 border-l-amber-500 bg-amber-50",
    icon: AlertTriangle,
    titleClass: "text-amber-800",
    textClass: "text-amber-700",
    badgeClass: "bg-amber-100 text-amber-800 border-amber-200",
    buttonVariant: "default",
  },
  info: {
    className: "border-l-4 border-l-neutral-400 bg-neutral-50",
    icon: Info,
    titleClass: "text-neutral-800",
    textClass: "text-neutral-700",
    badgeClass: "bg-neutral-100 text-neutral-700 border-neutral-200",
    buttonVariant: "default",
  },
};

export default function AlertCard({
  severity = "info",
  type,
  title,
  message,
  details,
  onAction,
  actionLabel,
  corrected,
}) {
  const config = SEVERITY_CONFIG[severity] || SEVERITY_CONFIG.info;
  const Icon = corrected ? CheckCircle2 : config.icon;

  return (
    <Alert className={`${corrected ? "border-l-4 border-l-green-500 bg-green-50" : config.className} mb-3`}>
      <Icon className={`h-5 w-5 mt-0.5 ${corrected ? "text-green-600" : ""}`} />
      <AlertTitle className={`flex items-center gap-2 flex-wrap ${corrected ? "text-green-800" : config.titleClass}`}>
        {corrected ? "CORRECTED" : severity.toUpperCase()}: {title}
        {type && (
          <Badge variant="outline" className={corrected ? "bg-green-100 text-green-800 border-green-200" : config.badgeClass}>
            {type.replace(/_/g, " ")}
          </Badge>
        )}
      </AlertTitle>
      <AlertDescription className={config.textClass}>
        <p className="mt-1 text-sm">{message}</p>

        {details && (
          <div className="mt-2 space-y-1 text-sm">
            {details.prescribed != null && (
              <p>
                <span className="font-medium">Prescribed:</span>{" "}
                {details.prescribed}
              </p>
            )}
            {details.recommended != null && (
              <p>
                <span className="font-medium">Should be:</span>{" "}
                {details.recommended}
              </p>
            )}
            {details.safeRange && (
              <p className="opacity-80">Safe range: {details.safeRange}</p>
            )}
          </div>
        )}

        {onAction && actionLabel && (
          <Button
            onClick={onAction}
            size="sm"
            variant={config.buttonVariant}
            className="mt-3"
          >
            {actionLabel}
          </Button>
        )}
      </AlertDescription>
    </Alert>
  );
}
