import nodemailer from 'nodemailer';

function getTransport() {
  const host = process.env.SMTP_HOST;
  const port = Number(process.env.SMTP_PORT || 587);
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;

  if (!host || !user || !pass) {
    return null;
  }

  return nodemailer.createTransport({
    host,
    port,
    secure: process.env.SMTP_SECURE === 'true' || port === 465,
    auth: { user, pass },
  });
}

export async function sendMentionEmail({ recipientName, recipientEmail, actorName, taskTitle, taskLink, commentContent }) {
  const transport = getTransport();
  if (!transport) {
    console.warn('❌ Email config missing - no transport available');
    return false;
  }

  const from = process.env.SMTP_FROM || process.env.SMTP_USER;
  if (!from) {
    console.warn('❌ SMTP_FROM not configured');
    return false;
  }

  const subject = `${actorName} mentioned you in ${taskTitle}`;
  const text = [
    `Hi ${recipientName},`,
    '',
    `${actorName} mentioned you in a comment on "${taskTitle}".`,
    '',
    `Comment: ${commentContent}`,
    '',
    `Open the task: ${taskLink}`,
    '',
    'FlowBoard',
  ].join('\n');

  const html = `
    <div style="font-family: Arial, sans-serif; line-height: 1.5; color: #111827;">
      <p>Hi ${recipientName},</p>
      <p><strong>${actorName}</strong> mentioned you in a comment on <strong>${taskTitle}</strong>.</p>
      <blockquote style="margin: 16px 0; padding: 12px 16px; background: #f9fafb; border-left: 4px solid #4f46e5; color: #374151;">
        ${commentContent}
      </blockquote>
      <p><a href="${taskLink}" style="color: #4f46e5; text-decoration: none; font-weight: 600;">Open the task</a></p>
      <p style="color: #6b7280; font-size: 12px;">FlowBoard</p>
    </div>
  `;

  try {
    const info = await transport.sendMail({
      from,
      to: recipientEmail,
      subject,
      text,
      html,
    });
    console.log(`✅ Email sent to ${recipientEmail} (${info.messageId})`);
    return true;
  } catch (err) {
    console.error(`❌ Email send failed to ${recipientEmail}:`, err.message);
    return false;
  }
}