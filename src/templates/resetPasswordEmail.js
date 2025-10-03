export function resetPasswordEmail(resetLink) {
  return `
<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta http-equiv="x-ua-compatible" content="ie=edge" />
    <meta name="viewport" content="width=device-width,initial-scale=1" />
  </head>
  <body style="margin:0;padding:0;background-color:#f6f6f6;">
    <table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="background-color:#f6f6f6;padding:20px 0;">
      <tr>
        <td align="center">
          <table role="presentation" cellpadding="0" cellspacing="0" width="600" style="max-width:600px;background:#ffffff;border-radius:8px;overflow:hidden;border:1px solid #e6e6e6;">
            <tr>
              <td style="padding:20px 24px;background:#ffffff;">
                <h1 style="margin:0;font-size:20px;font-weight:600;color:#111827;font-family:system-ui,-apple-system,Segoe UI,Roboto,'Helvetica Neue',Arial;">
                  Reset your password
                </h1>
              </td>
            </tr>

            <tr>
              <td style="padding:20px 24px;font-family:system-ui,-apple-system,Segoe UI,Roboto,'Helvetica Neue',Arial;color:#333333;line-height:1.5;">
                <p style="margin:0 0 12px;">
                  Hi,
                </p>

                <p style="margin:0 0 16px;">
                  We received a request to reset the password for your Stellar Uzima account. Click the button below to reset it. This link will expire in 15 minutes.
                </p>

                <table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="margin:18px 0;">
                  <tr>
                    <td align="center">
                      <a href="${resetLink}"
                         style="display:inline-block;padding:12px 20px;border-radius:6px;text-decoration:none;background:#111827;color:#ffffff;font-weight:600;font-size:15px;font-family:system-ui,-apple-system,Segoe UI,Roboto,'Helvetica Neue',Arial;"
                         target="_blank" rel="noopener noreferrer">
                        Reset password
                      </a>
                    </td>
                  </tr>
                </table>

                <p style="margin:0 0 12px;">
                  If you did not request a password reset, you can safely ignore this email and your password will remain unchanged.
                </p>

                <p style="margin:0 0 4px;color:#6b7280;font-size:13px;">
                  If the button above doesn’t work, copy and paste the following link into your browser:
                </p>
                <p style="word-break:break-all;margin:6px 0 0;color:#2563eb;font-size:13px;">
                  <a href="${resetLink}" style="color:#2563eb;text-decoration:underline;" target="_blank" rel="noopener noreferrer">${resetLink}</a>
                </p>
              </td>
            </tr>

            <tr>
              <td style="padding:16px 24px;background:#fafafa;color:#6b7280;font-family:system-ui,-apple-system,Segoe UI,Roboto,'Helvetica Neue',Arial;font-size:13px;">
                <p style="margin:0;">Thanks,<br/>The Stellar Uzima Team</p>
              </td>
            </tr>
          </table>

          <table role="presentation" cellpadding="0" cellspacing="0" width="600" style="max-width:600px;margin-top:12px;">
            <tr>
              <td align="center" style="font-family:system-ui,-apple-system,Segoe UI,Roboto,'Helvetica Neue',Arial;color:#9ca3af;font-size:12px;">
                <p style="margin:0;">
                  If you’re having trouble, contact our support.
                </p>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>
  `;
}
