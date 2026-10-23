import ExportAllStudents from "@/components/ExportAllStudents";

export default function ExportPage() {
  return (
    <>
      <p className="lede">
        Download a complete record of every student admitted so far — parents' names, contact details,
        batch, full fee breakdown, payments, billing and refund status — in a single CSV file.
      </p>
      <div className="card" style={{ maxWidth: 560 }}>
        <div className="card-head">
          <h2 className="card-title">Export all students</h2>
        </div>
        <ExportAllStudents />
      </div>
    </>
  );
}
