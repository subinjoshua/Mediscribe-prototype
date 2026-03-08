const API_BASE_URL = import.meta.env.VITE_API_URL || "http://localhost:3000";
const DISCHARGE_URL = import.meta.env.VITE_DISCHARGE_URL || "";

async function request(endpoint, options = {}) {
  const url = `${API_BASE_URL}${endpoint}`;
  const method = options.method || "GET";

  console.log(`[API] ${method} ${url}`, options.body ? JSON.parse(options.body) : "");

  const response = await fetch(url, {
    headers: { "Content-Type": "application/json" },
    ...options,
  });

  const data = await response.json();

  if (!response.ok) {
    const message = data.message || `API error: ${response.status} ${response.statusText}`;
    console.error(`[API] ${method} ${url} failed:`, message);
    throw new Error(message);
  }

  console.log(`[API] ${method} ${url} response:`, data);
  return data;
}

export async function processPhoto(imageBase64, doctorName = "Dr. Priya Sharma", hospitalId = "mumbai-gen") {
  return request("/process-photo", {
    method: "POST",
    body: JSON.stringify({ image: imageBase64, doctorName, hospitalId }),
  });
}

export async function validatePrescription(medications, patientContext) {
  return request("/validate-rx", {
    method: "POST",
    body: JSON.stringify({ medications, patientContext }),
  });
}

export async function checkOutbreak(hospitalId, newDiagnosis) {
  return request("/check-outbreak", {
    method: "POST",
    body: JSON.stringify({ hospitalId, newDiagnosis }),
  });
}

export async function getOutbreakDashboard(hospitalId = "mumbai-gen") {
  return request(`/outbreak-dashboard?hospitalId=${encodeURIComponent(hospitalId)}`);
}

export async function generateDischargeSummary(patientId, encounterId) {
  // Use Lambda Function URL to bypass API Gateway's 29-second timeout
  if (DISCHARGE_URL) {
    const url = DISCHARGE_URL;
    const body = JSON.stringify({ patientId, encounterId });
    console.log(`[API] POST ${url}`, { patientId, encounterId });
    const response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body,
    });
    const data = await response.json();
    if (!response.ok) {
      const message = data.message || `API error: ${response.status}`;
      console.error(`[API] POST ${url} failed:`, message);
      throw new Error(message);
    }
    console.log(`[API] POST ${url} response:`, data);
    return data;
  }
  return request("/discharge-summary", {
    method: "POST",
    body: JSON.stringify({ patientId, encounterId }),
  });
}

export async function getPatients() {
  return request("/patients");
}

export async function getPatient(patientId) {
  return request(`/patients/${encodeURIComponent(patientId)}`);
}

export async function seedData() {
  return request("/seed-data", { method: "POST" });
}
