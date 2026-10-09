// SCID format: SC + {both years of the fiscal year, e.g. 26 + 27 = "2627"} + "-" +
// {4-digit sequence} — e.g. SC2627-0001 for the first admission of FY 2026-27, SC2627-0142
// for the 142nd. The year part rolls over automatically every April along with the fiscal
// year, and the sequence is per-year (starts over at 0001 each new fiscal year), so a SCID
// on its own tells you which fiscal year an admission belongs to — handy when uploading or
// comparing admissions across fiscal years. Admissions saved before this format was
// introduced keep whatever SCID they already have; only new admissions get this format.
function scidYearPrefix() {
  const [startYear, endYY] = currentFiscalYear().split("-");
  return `${startYear.slice(-2)}${endYY}`;
}

function nextScidFromExisting(existingScids: (string | null)[], yearPrefix: string) {
  const pattern = new RegExp(`^SC${yearPrefix}-(\\d{4})$`, "i");
  let maxN = 0;
  for (const s of existingScids) {
    const m = s ? pattern.exec(s) : null;
    if (m) maxN = Math.max(maxN, parseInt(m[1], 10));
  }
  return `SC${yearPrefix}-${String(maxN + 1).padStart(4, "0")}`;
}

async function fetchNextScid(supabase: SupabaseClient) {
  const yearPrefix = scidYearPrefix();
  const { data } = await supabase.from("admissions").select("scid").ilike("scid", `SC${yearPrefix}-%`);
  return nextScidFromExisting(((data as any[]) || []).map((r) => r.scid), yearPrefix);
}
