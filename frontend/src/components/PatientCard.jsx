export default function PatientCard({ patient, compact = false, onClick, isSelected = false }) {
  if (!patient) return null;

  const diagnosis = patient.primaryDiagnosis || patient.diagnosis;
  const diagnosisText = typeof diagnosis === "object"
    ? `${diagnosis.description}${diagnosis.code ? ` (${diagnosis.code})` : ""}`
    : diagnosis || "";

  const baseClasses = "bg-white rounded-lg shadow transition-shadow";
  const interactiveClasses = onClick ? "cursor-pointer hover:shadow-md" : "";
  const selectedClasses = isSelected ? "ring-2 ring-blue-500 bg-blue-50" : "";

  if (compact) {
    return (
      <div
        className={`${baseClasses} ${interactiveClasses} ${selectedClasses} px-4 py-3`}
        onClick={onClick}
      >
        <div className="flex items-center gap-2">
          <span className="text-lg">👤</span>
          <span className="font-semibold text-gray-900">{patient.name}</span>
          <span className="text-sm text-gray-500">
            {patient.age}{patient.gender ? patient.gender.charAt(0).toUpperCase() : ""}
          </span>
          {diagnosisText && (
            <>
              <span className="text-gray-300">|</span>
              <span className="text-sm text-gray-600">{diagnosisText}</span>
            </>
          )}
        </div>
      </div>
    );
  }

  return (
    <div
      className={`${baseClasses} ${interactiveClasses} ${selectedClasses} p-5`}
      onClick={onClick}
    >
      {/* Header */}
      <div className="flex items-center gap-2 mb-1">
        <span className="text-lg">👤</span>
        <h3 className="font-semibold text-gray-900 text-lg">{patient.name || "Patient"}</h3>
      </div>
      <p className="text-sm text-gray-500 mb-3">
        {patient.age ? `${patient.age}` : ""}
        {patient.gender ? `/${patient.gender}` : ""}
      </p>

      {/* Chief Complaint & Diagnosis */}
      {(patient.chiefComplaint || diagnosisText) && (
        <>
          <div className="border-t border-gray-200 my-3" />
          {patient.chiefComplaint && (
            <p className="text-sm text-gray-700 mb-2">
              <span className="font-medium text-gray-500">Chief Complaint: </span>
              <span className="line-clamp-2">{patient.chiefComplaint}</span>
            </p>
          )}
          {diagnosisText && (
            <p className="text-sm text-gray-700">
              <span className="font-medium text-gray-500">Diagnosis: </span>
              {diagnosisText}
            </p>
          )}
        </>
      )}

      {/* Vitals */}
      {patient.vitals && (
        <>
          <div className="border-t border-gray-200 my-3" />
          <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
            {patient.vitals.bloodPressure && (
              <div>
                <span className="text-gray-500">BP: </span>
                <span className="font-semibold text-gray-900">{patient.vitals.bloodPressure}</span>
              </div>
            )}
            {patient.vitals.heartRate && (
              <div>
                <span className="text-gray-500">HR: </span>
                <span className="font-semibold text-gray-900">{patient.vitals.heartRate}</span>
              </div>
            )}
            {patient.vitals.temperature && (
              <div>
                <span className="text-gray-500">Temp: </span>
                <span className="font-semibold text-gray-900">{patient.vitals.temperature}°F</span>
              </div>
            )}
            {patient.vitals.spO2 && (
              <div>
                <span className="text-gray-500">SpO2: </span>
                <span className="font-semibold text-gray-900">{patient.vitals.spO2}%</span>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
