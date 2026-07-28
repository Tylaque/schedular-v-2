import { NextResponse } from "next/server";
import ExcelJS from "exceljs";

export async function GET() {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = "Scheduler";
  workbook.created = new Date();

  const sheet = workbook.addWorksheet("Participants");
  sheet.columns = [
    { header: "Name", key: "name", width: 30 },
    { header: "Email", key: "email", width: 35 },
    { header: "Company", key: "company", width: 25 },
    { header: "Role", key: "role", width: 20 },
  ];

  sheet.getRow(1).font = { bold: true };
  sheet.getRow(1).fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFF3F4F6" } };

  const buffer = await workbook.xlsx.writeBuffer();
  return new NextResponse(buffer, {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": 'attachment; filename="participants-template.xlsx"',
    },
  });
}
