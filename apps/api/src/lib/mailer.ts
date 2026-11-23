/**
 * Outgoing email. In this project it only logs — swap the body of `sendEmail` for a real
 * provider (Resend, SES, SendGrid, Nodemailer + SMTP) when you have one. Callers don't change.
 *
 * Tip: most providers accept an idempotency key (e.g. Resend's `Idempotency-Key` header).
 * Pass `idempotencyKey` through so even a retry that slips past our own de-dup can't
 * deliver the same email twice.
 */
export type Email = { to: string; subject: string; text: string; idempotencyKey?: string }

export async function sendEmail(email: Email): Promise<void> {
  const line = '─'.repeat(60)
  console.log(`\n✉️  [mailer] to: ${email.to}\n   subject: ${email.subject}\n${line}\n${email.text}\n${line}\n`)
}
