import nodemailer from 'nodemailer';

function createTransportInstance({ host, port, secure, user, pass } = {}) {
  return nodemailer.createTransport({
    pool: true,
    host,
    port,
    secure,
    auth: { user, pass },
    // timeouts help avoid long hangs in production environments
    connectionTimeout: Number(process.env.SMTP_CONNECTION_TIMEOUT || 10000),
    greetingTimeout: Number(process.env.SMTP_GREETING_TIMEOUT || 10000),
    socketTimeout: Number(process.env.SMTP_SOCKET_TIMEOUT || 10000),
    tls: { rejectUnauthorized: process.env.SMTP_TLS_REJECT_UNAUTHORIZED !== 'false' },
  });
}

function getTransportOptions(overrides = {}) {
  const host = process.env.SMTP_HOST;
  const port = Number(process.env.SMTP_PORT || 587);
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;

  if (!host || !user || !pass) return null;

  const secure = overrides.secure !== undefined ? overrides.secure : (process.env.SMTP_SECURE === 'true' || port === 465);
  const finalPort = overrides.port || port;

  return { host, port: finalPort, secure, user, pass };
}

export async function sendMentionEmail({ recipientName, recipientEmail, actorName, taskTitle, taskLink, commentContent }) {
  const opts = getTransportOptions();
  if (!opts) {
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

  // try primary transport, then fallback to secure port 465 if timeout/connection error occurs
  async function trySend(options) {
    const transport = createTransportInstance(options);
    try {
      const info = await transport.sendMail({ from, to: recipientEmail, subject, text, html });
      console.log(`✅ Email sent to ${recipientEmail} (${info.messageId}) via ${options.host}:${options.port}`);
      return true;
    } catch (err) {
      console.error(`❌ Email send failed to ${recipientEmail} via ${options.host}:${options.port}:`, err && err.message ? err.message : err);
      return { ok: false, err };
    }
  }

  // first attempt with configured options
  const primary = await trySend(opts);
  if (primary === true) return true;

  const errObj = primary && primary.err ? primary.err : null;
  const msg = errObj && errObj.message ? errObj.message.toLowerCase() : '';

  // if connection issues, try fallback to port 465 with secure=true
  if (msg.includes('timeout') || msg.includes('timed out') || msg.includes('etimedout') || msg.includes('ec timed out') || msg.includes('connect')) {
    console.log('🔁 Attempting fallback to SMTPS (port 465)');
    const fallbackOpts = getTransportOptions({ port: 465, secure: true });
    if (fallbackOpts) {
      const fallback = await trySend(fallbackOpts);
      if (fallback === true) return true;
    }
  }

  // final fallback: return false and log full error for investigation
  console.error('❌ All email send attempts failed for', recipientEmail);
  return false;
}