import { Resend } from "resend";

/**
 * Transactional email — campus app.
 *
 * Best-effort by design: if `RESEND_API_KEY` isn't configured (or
 * Resend rejects the send), the helpers return `{ sent: false }`
 * without throwing, and callers fall back to a shareable link. So a
 * missing email setup degrades gracefully rather than breaking the
 * flow.
 *
 * Server-only — never import this from a client component (`resend`
 * pulls in Node APIs).
 */

interface OrgInviteParams {
  to: string;
  orgName: string;
  inviterName: string;
  inviteUrl: string;
}

/** Send an organization-invite email. */
export async function sendOrgInviteEmail(
  params: OrgInviteParams,
): Promise<{ sent: boolean }> {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) return { sent: false };

  const from = process.env.EMAIL_FROM ?? "Klorad <onboarding@resend.dev>";
  try {
    const resend = new Resend(apiKey);
    const result = await resend.emails.send({
      from,
      to: params.to,
      subject: `You've been invited to join ${params.orgName} on Klorad`,
      html: orgInviteHtml(params),
    });
    return { sent: !result.error };
  } catch {
    return { sent: false };
  }
}

function orgInviteHtml({
  orgName,
  inviterName,
  inviteUrl,
}: OrgInviteParams): string {
  const org = escapeHtml(orgName);
  const inviter = escapeHtml(inviterName);
  return `<!doctype html>
<html>
  <body style="margin:0;background:#eef1f4;font-family:Inter,Arial,sans-serif;">
    <div style="max-width:480px;margin:0 auto;padding:32px 24px;">
      <div style="background:#ffffff;border-radius:16px;padding:32px;">
        <div style="font-size:13px;font-weight:600;letter-spacing:0.14em;text-transform:uppercase;color:#158ca3;">Klorad</div>
        <h1 style="font-size:20px;color:#0b1116;margin:16px 0 8px;">You're invited to ${org}</h1>
        <p style="font-size:15px;line-height:1.6;color:#48535f;margin:0 0 24px;">
          ${inviter} has invited you to join <strong>${org}</strong> on Klorad Campus.
        </p>
        <a href="${inviteUrl}" style="display:inline-block;background:#158ca3;color:#ffffff;font-size:15px;font-weight:600;text-decoration:none;padding:12px 24px;border-radius:999px;">Accept invitation</a>
        <p style="font-size:13px;line-height:1.6;color:#8a95a1;margin:24px 0 0;">
          Or paste this link into your browser:<br/>
          <a href="${inviteUrl}" style="color:#158ca3;word-break:break-all;">${inviteUrl}</a>
        </p>
        <p style="font-size:13px;color:#8a95a1;margin:16px 0 0;">This invitation expires in 7 days.</p>
      </div>
    </div>
  </body>
</html>`;
}

function escapeHtml(value: string): string {
  return value.replace(
    /[&<>"]/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c] ?? c,
  );
}
