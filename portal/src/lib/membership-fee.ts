// Membership fee and how members pay it. Agreed on the 16 Nov 2026 call:
// 3,600 INR a year, paid by UPI QR or bank transfer after an admin approves
// the application. There is no payment gateway yet (Phase 2).
export const MEMBERSHIP_FEE_INR = 3600;
export const MEMBERSHIP_FEE_LABEL = "₹3,600 a year";

// TODO(client): Sandeep sends the UPI QR image and the bank details on the
// MCAC WhatsApp group. Put the QR file at public/payment/mcac-upi-qr.png, then
// set the values below. Do not invent any of them. While a value is null the
// page tells members that MCAC sends the details by WhatsApp.
export const PAYMENT_DETAILS: {
  qrImagePath: string | null;
  accountName: string | null;
  bankName: string | null;
  accountNumber: string | null;
  ifsc: string | null;
  upiId: string | null;
} = {
  qrImagePath: null,
  accountName: null,
  bankName: null,
  accountNumber: null,
  ifsc: null,
  upiId: null,
};
