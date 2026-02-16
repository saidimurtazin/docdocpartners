/**
 * PDF generation for payment acts (Акт об оказании услуг)
 * Uses PDFKit with DejaVuSans font for Cyrillic support
 */

import PDFDocument from "pdfkit";
import path from "path";
import { amountToWordsRu } from "./amount-to-words-ru";

// Use process.cwd() because esbuild bundles into dist/index.js
// but fonts remain in server/fonts/ at the project root
const FONT_DIR = path.join(process.cwd(), "server", "fonts");
const FONT_REGULAR = path.join(FONT_DIR, "DejaVuSans.ttf");
const FONT_BOLD = path.join(FONT_DIR, "DejaVuSans-Bold.ttf");

export interface ActPdfData {
  actNumber: string;
  actDate: Date;
  periodStart: Date;
  periodEnd: Date;
  agent: {
    fullName: string;
    inn: string;
    bankName: string;
    bankAccount: string;
    bankBik: string;
    isSelfEmployed: boolean;
  };
  referrals: Array<{
    id: number;
    patientInitials: string;
    clinic: string;
    treatmentAmount: number; // kopecks
    commissionAmount: number; // kopecks
  }>;
  totalAmount: number; // kopecks
  company: {
    name: string;
    inn: string;
    ogrn: string;
    address: string;
    bankName: string;
    bankAccount: string;
    bankBik: string;
    director: string;
  };
}

function formatDate(d: Date): string {
  return d.toLocaleDateString("ru-RU", { year: "numeric", month: "long", day: "numeric" });
}

function formatDateShort(d: Date): string {
  return d.toLocaleDateString("ru-RU", { year: "numeric", month: "2-digit", day: "2-digit" });
}

function formatMoney(kopecks: number): string {
  return (kopecks / 100).toLocaleString("ru-RU", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export async function generatePaymentActPdf(data: ActPdfData): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    try {
      const doc = new PDFDocument({ size: "A4", margin: 50 });
      const chunks: Buffer[] = [];

      doc.on("data", (chunk: Buffer) => chunks.push(chunk));
      doc.on("end", () => resolve(Buffer.concat(chunks)));
      doc.on("error", reject);

      // Register fonts
      doc.registerFont("Regular", FONT_REGULAR);
      doc.registerFont("Bold", FONT_BOLD);

      const pageWidth = doc.page.width - 100; // minus margins

      // ====== HEADER ======
      doc.font("Bold").fontSize(14).text(
        `АКТ об оказании услуг № ${data.actNumber}`,
        { align: "center" }
      );
      doc.font("Regular").fontSize(10).text(
        `от ${formatDate(data.actDate)} г.`,
        { align: "center" }
      );
      doc.moveDown(1.5);

      // ====== PARTIES ======
      doc.font("Regular").fontSize(9);

      doc.font("Bold").text("Заказчик: ", { continued: true });
      doc.font("Regular").text(
        `${data.company.name}, ИНН ${data.company.inn}, ОГРНИП ${data.company.ogrn}, адрес: ${data.company.address}, ` +
        `р/с ${data.company.bankAccount}, ${data.company.bankName}, БИК ${data.company.bankBik}`
      );
      doc.moveDown(0.5);

      doc.font("Bold").text("Исполнитель: ", { continued: true });
      doc.font("Regular").text(
        `${data.agent.fullName}, ИНН ${data.agent.inn}, ` +
        `р/с ${data.agent.bankAccount}, ${data.agent.bankName}, БИК ${data.agent.bankBik}` +
        (data.agent.isSelfEmployed ? " (самозанятый)" : "")
      );
      doc.moveDown(1.5);

      // ====== BODY TEXT ======
      doc.font("Regular").fontSize(9).text(
        `Исполнитель оказал, а Заказчик принял следующие услуги по привлечению пациентов ` +
        `за период с ${formatDateShort(data.periodStart)} по ${formatDateShort(data.periodEnd)}:`
      );
      doc.moveDown(1);

      // ====== TABLE ======
      const colWidths = [30, 130, 120, 100, 100];
      const headers = ["№", "Пациент", "Клиника", "Сумма лечения", "Комиссия"];
      const tableLeft = 50;
      let tableY = doc.y;

      // Header row
      doc.font("Bold").fontSize(8);
      let xPos = tableLeft;
      for (let i = 0; i < headers.length; i++) {
        doc.rect(xPos, tableY, colWidths[i], 20).stroke();
        doc.text(headers[i], xPos + 3, tableY + 5, { width: colWidths[i] - 6, align: "center" });
        xPos += colWidths[i];
      }
      tableY += 20;

      // Data rows
      doc.font("Regular").fontSize(8);
      for (let idx = 0; idx < data.referrals.length; idx++) {
        const ref = data.referrals[idx];
        const rowHeight = 18;

        // Check page break
        if (tableY + rowHeight > doc.page.height - 120) {
          doc.addPage();
          tableY = 50;
        }

        xPos = tableLeft;
        const rowData = [
          String(idx + 1),
          ref.patientInitials,
          ref.clinic || "—",
          formatMoney(ref.treatmentAmount),
          formatMoney(ref.commissionAmount),
        ];

        for (let i = 0; i < rowData.length; i++) {
          doc.rect(xPos, tableY, colWidths[i], rowHeight).stroke();
          const align = i >= 3 ? "right" as const : "left" as const;
          doc.text(rowData[i], xPos + 3, tableY + 4, { width: colWidths[i] - 6, align });
          xPos += colWidths[i];
        }
        tableY += rowHeight;
      }

      // Totals row
      const totalRowWidth = colWidths[0] + colWidths[1] + colWidths[2];
      doc.font("Bold").fontSize(8);
      doc.rect(tableLeft, tableY, totalRowWidth, 20).stroke();
      doc.text("ИТОГО:", tableLeft + 3, tableY + 5, { width: totalRowWidth - 6, align: "right" });

      xPos = tableLeft + totalRowWidth;
      doc.rect(xPos, tableY, colWidths[3], 20).stroke();
      doc.text("", xPos + 3, tableY + 5, { width: colWidths[3] - 6, align: "right" });
      xPos += colWidths[3];

      doc.rect(xPos, tableY, colWidths[4], 20).stroke();
      doc.text(formatMoney(data.totalAmount), xPos + 3, tableY + 5, { width: colWidths[4] - 6, align: "right" });

      doc.y = tableY + 30;

      // ====== TOTAL IN WORDS ======
      doc.font("Bold").fontSize(9).text(
        `Итого к оплате: ${formatMoney(data.totalAmount)} руб. (${amountToWordsRu(data.totalAmount)})`,
        tableLeft
      );
      doc.moveDown(1);

      // ====== NO CLAIMS ======
      doc.font("Regular").fontSize(9).text(
        "Вышеперечисленные услуги выполнены полностью и в срок. Заказчик претензий по объему, " +
        "качеству и срокам оказания услуг не имеет."
      );
      doc.moveDown(2);

      // ====== SIGNATURES ======
      const sigY = doc.y;
      const halfWidth = pageWidth / 2 - 10;

      // Left: Заказчик
      doc.font("Bold").fontSize(9).text("Заказчик:", tableLeft, sigY);
      doc.moveDown(0.3);
      doc.font("Regular").fontSize(8).text(data.company.name, tableLeft);
      doc.moveDown(1.5);
      doc.text("_________________________", tableLeft);
      doc.moveDown(0.3);
      doc.font("Regular").fontSize(7).text(data.company.director, tableLeft);

      // Right: Исполнитель
      const rightX = tableLeft + halfWidth + 20;
      doc.font("Bold").fontSize(9).text("Исполнитель:", rightX, sigY);
      doc.y = sigY;
      doc.moveDown(0.3);
      doc.font("Regular").fontSize(8).text(data.agent.fullName, rightX);
      doc.moveDown(1.5);
      doc.text("_________________________", rightX);
      doc.moveDown(0.3);
      doc.font("Regular").fontSize(7).text(data.agent.fullName, rightX);

      doc.moveDown(3);

      // ====== PEP FOOTER ======
      doc.font("Regular").fontSize(7).fillColor("#666666").text(
        "Настоящий акт подписан простой электронной подписью (ПЭП) в соответствии с " +
        "Федеральным законом от 06.04.2011 № 63-ФЗ «Об электронной подписи». " +
        "Подтверждение осуществлено посредством одноразового кода (OTP), направленного через Telegram.",
        tableLeft,
        undefined,
        { width: pageWidth }
      );

      doc.end();
    } catch (err) {
      reject(err);
    }
  });
}

/**
 * Convert full name to initials for privacy
 * "Иванов Иван Иванович" → "И.И. Иванов"
 */
export function toPatientInitials(fullName: string): string {
  const parts = fullName.trim().split(/\s+/);
  if (parts.length === 0) return "—";
  if (parts.length === 1) return `${parts[0][0]}.`;
  // Assume: Last First Middle
  const lastName = parts[0];
  const initials = parts.slice(1).map(p => `${p[0]}.`).join("");
  return `${initials} ${lastName}`;
}
