// Shared mailer abstraction (orchestrator-owned contract). Console transport
// when RESEND_API_KEY is empty, Resend HTTP API otherwise. Callers must treat
// send failures as non-blocking: log, never throw into the user action.

export type Mail = {
  to: string;
  subject: string;
  text: string;
};

export async function sendMail(mail: Mail): Promise<{ delivered: boolean }> {
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.EMAIL_FROM ?? "MCAC Portal <onboarding@localhost>";

  if (!apiKey) {
    if (process.env.NODE_ENV === "production") {
      console.error("[mail] RESEND_API_KEY is not configured");
      return { delivered: false };
    }
    console.log(
      `[mail:console] to=${mail.to} subject=${JSON.stringify(mail.subject)}\n${mail.text}`,
    );
    return { delivered: true };
  }

  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ from, to: mail.to, subject: mail.subject, text: mail.text }),
    });
    if (!res.ok) {
      console.error(`[mail] send failed: ${res.status} ${await res.text()}`);
      return { delivered: false };
    }
    return { delivered: true };
  } catch (e) {
    console.error("[mail] send failed", e);
    return { delivered: false };
  }
}
