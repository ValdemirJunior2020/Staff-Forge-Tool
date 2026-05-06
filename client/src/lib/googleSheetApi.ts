// client/src/lib/googleSheetApi.ts

const GOOGLE_SCRIPT_URL =
  "https://script.google.com/macros/s/AKfycbzY3cZXkNKW4Ab2eAEiDmiesUFL82c7uPqQO6JuqfhDEPEaKtSvEe0DBK1vJuciRl_tFQ/exec";

export type GoogleSheetResponse<T> = {
  success: boolean;
  sheetName: string;
  rows: T[];
  totalRows: number;
  message?: string;
};

export async function getGoogleSheetRows<T>(
  sheetName: string
): Promise<T[]> {
  try {
    const response = await fetch(
      `${GOOGLE_SCRIPT_URL}?sheet=${encodeURIComponent(sheetName)}`
    );

    const data: GoogleSheetResponse<T> = await response.json();

    if (!data.success) {
      console.warn("Google Sheet API failed:", data.message);
      return [];
    }

    return data.rows || [];
  } catch (error) {
    console.error("Google Sheet API error:", error);
    return [];
  }
}