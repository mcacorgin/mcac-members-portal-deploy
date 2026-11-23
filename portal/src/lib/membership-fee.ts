// Membership fee and how members pay it. Agreed on the 16 Nov 2026 call:
// 3,600 INR a year, paid by UPI QR or bank transfer after an admin approves
// the application. There is no payment gateway yet (Phase 2).
export const MEMBERSHIP_FEE_INR = 3600;
export const MEMBERSHIP_FEE_LABEL = "₹3,600 a year";

// Sent by Sachin on the MCAC WhatsApp group on 17 Nov 2026. These are shown to
// members on purpose; they are not secrets. The UPI ID is the one encoded in
// the QR image (public/payment/mcac-upi-qr.jpg). While a value is null the
// page tells members that MCAC sends the details by WhatsApp.
export const PAYMENT_DETAILS: {
  qrImagePath: string | null;
  accountName: string | null;
  bankName: string | null;
  accountType: string | null;
  accountNumber: string | null;
  ifsc: string | null;
  branch: string | null;
  upiId: string | null;
} = {
  qrImagePath: "/payment/mcac-upi-qr.jpg",
  accountName: "MARATHI CORPORATE ADVISORY COLLECTIVE",
  bankName: "HDFC Bank",
  accountType: "Current account",
  accountNumber: "50200126865030",
  ifsc: "HDFC0000047",
  branch: "Malad West, Orlem",
  upiId: "9869276762@upi",
};
