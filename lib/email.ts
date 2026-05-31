import nodemailer from 'nodemailer';

const transporter = nodemailer.createTransport({
  host: 'smtp.gmail.com',
  port: 587,
  secure: false,
  auth: {
    user: 'cheatsheetshq@gmail.com',
    pass: (process.env.GMAIL_APP_PASSWORD ?? '').replace(/-/g, ''),
  },
});

export async function sendTrialEndingEmail(to: string, firstName: string, chargeDate: Date, amount: string) {
  await transporter.sendMail({
    from: '"Cheat Sheets" <support@cheatsheets.co.uk>',
    to,
    subject: 'Your Cheat Sheets trial ends tomorrow',
    html: `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#080c14;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#080c14;padding:40px 16px">
    <tr><td align="center">
      <table width="100%" style="max-width:520px;background:#0f1623;border-radius:16px;border:1px solid rgba(255,255,255,0.08);padding:40px 32px" cellpadding="0" cellspacing="0">

        <tr><td style="padding-bottom:24px">
          <p style="margin:0;font-size:22px;font-weight:900;color:#ffffff;letter-spacing:-0.5px">Cheat Sheets</p>
          <p style="margin:4px 0 0;font-size:11px;color:rgba(255,255,255,0.3);text-transform:uppercase;letter-spacing:2px">Football match analysis</p>
        </td></tr>

        <tr><td style="padding-bottom:20px">
          <h1 style="margin:0;font-size:24px;font-weight:900;color:#ffffff">Your trial ends tomorrow${firstName ? `, ${firstName}` : ''}.</h1>
        </td></tr>

        <tr><td style="padding-bottom:24px">
          <p style="margin:0;font-size:15px;color:rgba(255,255,255,0.6);line-height:1.6">
            Your free trial ends on <strong>${chargeDate.toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })}</strong>. Your card will be charged <strong>${amount}</strong> to continue your subscription.
          </p>
        </td></tr>

        <tr><td style="padding-bottom:24px">
          <p style="margin:0;font-size:14px;color:rgba(255,255,255,0.5);line-height:1.7">
            If you want to cancel before being charged, you can do so from your account page. No questions asked.
          </p>
        </td></tr>

        <tr><td style="padding-bottom:32px">
          <a href="https://www.cheatsheets.co.uk/account"
            style="display:inline-block;background:#16a34a;color:#ffffff;font-size:14px;font-weight:700;padding:14px 28px;border-radius:10px;text-decoration:none">
            Manage subscription
          </a>
        </td></tr>

        <tr><td>
          <p style="margin:0;font-size:12px;color:rgba(255,255,255,0.2);line-height:1.6">
            Questions? Reply to this email or contact <a href="mailto:support@cheatsheets.co.uk" style="color:rgba(255,255,255,0.35)">support@cheatsheets.co.uk</a>.<br>
            Cheat Sheets Ltd · <a href="https://www.cheatsheets.co.uk/account" style="color:rgba(255,255,255,0.35)">Manage subscription</a>
          </p>
        </td></tr>

      </table>
    </td></tr>
  </table>
</body>
</html>`,
  });
}

export async function sendWelcomeEmail(to: string, firstName: string, trialEnd: Date | null) {
  const trialLine = trialEnd
    ? `Your 3-day free trial runs until <strong>${trialEnd.toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })}</strong>. No charge until then.`
    : 'Your subscription is now active.';

  await transporter.sendMail({
    from: '"Cheat Sheets" <support@cheatsheets.co.uk>',
    to,
    subject: 'Welcome to Cheat Sheets: your trial has started',
    html: `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#080c14;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#080c14;padding:40px 16px">
    <tr><td align="center">
      <table width="100%" style="max-width:520px;background:#0f1623;border-radius:16px;border:1px solid rgba(255,255,255,0.08);padding:40px 32px" cellpadding="0" cellspacing="0">

        <tr><td style="padding-bottom:24px">
          <p style="margin:0;font-size:22px;font-weight:900;color:#ffffff;letter-spacing:-0.5px">Cheat Sheets</p>
          <p style="margin:4px 0 0;font-size:11px;color:rgba(255,255,255,0.3);text-transform:uppercase;letter-spacing:2px">Football match analysis</p>
        </td></tr>

        <tr><td style="padding-bottom:20px">
          <h1 style="margin:0;font-size:24px;font-weight:900;color:#ffffff">You&rsquo;re in${firstName ? `, ${firstName}` : ''}.</h1>
        </td></tr>

        <tr><td style="padding-bottom:24px">
          <p style="margin:0;font-size:15px;color:rgba(255,255,255,0.6);line-height:1.6">${trialLine}</p>
        </td></tr>

        <tr><td style="padding-bottom:32px">
          <p style="margin:0;font-size:14px;color:rgba(255,255,255,0.5);line-height:1.7">
            You now have full access to every cheat sheet: confirmed lineups, player form dots, team stats, probabilities and referee data across every major competition.
          </p>
        </td></tr>

        <tr><td style="padding-bottom:32px">
          <a href="https://www.cheatsheets.co.uk/dashboard"
            style="display:inline-block;background:#16a34a;color:#ffffff;font-size:14px;font-weight:700;padding:14px 28px;border-radius:10px;text-decoration:none">
            View today&rsquo;s fixtures →
          </a>
        </td></tr>

        <tr><td>
          <p style="margin:0;font-size:12px;color:rgba(255,255,255,0.2);line-height:1.6">
            Questions? Reply to this email or contact <a href="mailto:support@cheatsheets.co.uk" style="color:rgba(255,255,255,0.35)">support@cheatsheets.co.uk</a>.<br>
            Cheat Sheets Ltd · <a href="https://www.cheatsheets.co.uk/account" style="color:rgba(255,255,255,0.35)">Manage subscription</a>
          </p>
        </td></tr>

      </table>
    </td></tr>
  </table>
</body>
</html>`,
  });
}
