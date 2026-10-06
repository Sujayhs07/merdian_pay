import nodemailer from "nodemailer";

/**
 * Sends a professionally styled crypto invoice email to a customer.
 * Supports:
 * 1. Resend API (if RESEND_API_KEY is defined)
 * 2. Standard SMTP via Nodemailer (if SMTP_HOST & SMTP_USER are defined)
 * 3. Graceful simulation/preview fallback for local development & hackathon demo
 */
function escapeHtml(str) {
  if (!str) return "";
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

export async function sendInvoiceEmail({ to, invoice, checkoutUrl }) {
  if (!to || typeof to !== "string" || !to.includes("@")) {
    throw new Error("A valid recipient email address is required.");
  }

  const merchantName = invoice.business_name || invoice.businessName || "MeridianPay Merchant";
  const amountStr = `${invoice.amount} ${invoice.token || "USDC"}`;
  const description = invoice.description || "Invoice Payment";
  const invoiceId = invoice.id;
  const expiryDate = invoice.expires_at || invoice.expiresAt
    ? new Date(invoice.expires_at || invoice.expiresAt).toLocaleString()
    : "24 hours";

  const safeMerchantName = escapeHtml(merchantName);
  const safeAmountStr = escapeHtml(amountStr);
  const safeDescription = escapeHtml(description);
  const safeInvoiceId = escapeHtml(invoiceId);
  const safeExpiryDate = escapeHtml(expiryDate);
  const safeCheckoutUrl = escapeHtml(checkoutUrl);

  const subject = `Invoice from ${merchantName}: ${amountStr} for ${description}`;

  const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background: #08090b; color: #f0f2f5; margin: 0; padding: 24px; }
    .container { max-width: 540px; margin: 0 auto; background: #0e1116; border: 1px solid #1a202c; border-radius: 12px; padding: 32px 28px; }
    .header { display: flex; align-items: center; justify-content: space-between; border-bottom: 1px solid #1f2733; padding-bottom: 20px; margin-bottom: 24px; }
    .brand { font-size: 18px; font-weight: 700; color: #3ecf8e; letter-spacing: -0.01em; }
    .amount-box { background: rgba(62, 207, 142, 0.08); border: 1px solid rgba(62, 207, 142, 0.25); border-radius: 10px; padding: 20px; text-align: center; margin: 24px 0; }
    .amount-val { font-size: 32px; font-weight: 800; color: #ffffff; letter-spacing: -0.02em; }
    .amount-label { font-size: 13px; color: #8a99a8; margin-top: 4px; }
    .details-table { width: 100%; border-collapse: collapse; margin-bottom: 28px; font-size: 14px; }
    .details-table td { padding: 10px 0; border-bottom: 1px solid #18202c; }
    .details-table td.label { color: #8a99a8; width: 40%; }
    .details-table td.val { color: #ffffff; font-weight: 500; text-align: right; }
    .btn { display: block; background: #3ecf8e; color: #08090b !important; text-align: center; font-weight: 700; text-decoration: none; padding: 14px 24px; border-radius: 8px; font-size: 15px; margin: 24px 0; }
    .footer { text-align: center; font-size: 12px; color: #5a6675; margin-top: 24px; line-height: 1.5; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <div class="brand">MeridianPay</div>
      <div style="font-size: 13px; color: #8a99a8;">Invoice #${safeInvoiceId}</div>
    </div>

    <p style="font-size: 15px; color: #d0d7de; margin: 0 0 16px;">
      Hello, you have received a new payment request from <strong>${safeMerchantName}</strong>.
    </p>

    <div class="amount-box">
      <div class="amount-val">${safeAmountStr}</div>
      <div class="amount-label">Payable via Solana Pay (USDC) or Cross-Chain Ethereum</div>
    </div>

    <table class="details-table">
      <tr>
        <td class="label">Merchant</td>
        <td class="val">${safeMerchantName}</td>
      </tr>
      <tr>
        <td class="label">Description</td>
        <td class="val">${safeDescription}</td>
      </tr>
      <tr>
        <td class="label">Invoice ID</td>
        <td class="val" style="font-family: monospace;">${safeInvoiceId}</td>
      </tr>
      <tr>
        <td class="label">Expires</td>
        <td class="val">${safeExpiryDate}</td>
      </tr>
    </table>

    <a href="${safeCheckoutUrl}" class="btn">Pay Invoice Online &rarr;</a>

    <div class="footer">
      Powered by MeridianPay &bull; Instant Non-Custodial USDC Settlement on Solana.<br>
      If you have questions, please reach out directly to ${merchantName}.
    </div>
  </div>
</body>
</html>
  `.trim();

  const text = `
Invoice from ${merchantName}
------------------------------------------------
Amount: ${amountStr}
Description: ${description}
Invoice ID: ${invoiceId}
Expires: ${expiryDate}

Pay Online: ${checkoutUrl}
------------------------------------------------
Powered by MeridianPay.
  `.trim();

  // 1. Check if Resend API key is configured
  if (process.env.RESEND_API_KEY) {
    try {
      const res = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${process.env.RESEND_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          from: process.env.EMAIL_FROM || "invoicing@meridianpay.io",
          to: [to],
          subject,
          html,
          text,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data?.message || "Resend email delivery failed.");
      }
      return { success: true, provider: "resend", id: data.id };
    } catch (err) {
      console.warn("Resend email delivery error:", err.message);
      // fallback to nodemailer or simulation
    }
  }

  // 2. Check if standard SMTP configuration exists
  if (process.env.SMTP_HOST && process.env.SMTP_USER) {
    const transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: Number(process.env.SMTP_PORT) || 587,
      secure: Number(process.env.SMTP_PORT) === 465,
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
      },
    });

    const info = await transporter.sendMail({
      from: process.env.EMAIL_FROM || `"${merchantName}" <${process.env.SMTP_USER}>`,
      to,
      subject,
      text,
      html,
    });

    return { success: true, provider: "smtp", messageId: info.messageId };
  }

  // 3. Fallback / Dev mode: simulate delivery and log email preview
  console.log("------------------------------------------");
  console.log(`[EMAIL DISPATCH SIMULATION]`);
  console.log(`To: ${to}`);
  console.log(`Subject: ${subject}`);
  console.log(`Checkout URL: ${checkoutUrl}`);
  console.log("------------------------------------------");

  return {
    success: true,
    provider: "simulated",
    to,
    subject,
    note: "Email generated successfully. Configure RESEND_API_KEY or SMTP credentials in api/.env for live delivery.",
  };
}
