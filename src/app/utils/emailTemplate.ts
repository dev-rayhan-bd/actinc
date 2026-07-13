interface IEmailOptions {
  userName: string;
  title: string;
  body: string;
  otpCode?: string;
  buttonText?: string;
  buttonLink?: string;
}

export const getEmailTemplate = ({
  userName,
  title,
  body,
  otpCode,
  buttonText,
  buttonLink,
}: IEmailOptions): string => {
  const logoUrl =
    "https://res.cloudinary.com/da1uxchgo/image/upload/v1781263900/un4seen/i9ti2hs0hnzi8apxz5fj.png";
  const brandColor = "#BE185D"; // Your brand primary color

  return `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <style>
        /* General Reset */
        body { margin: 0; padding: 0; font-family: 'Segoe UI', Helvetica, Arial, sans-serif; background-color: #f4f4f7; color: #333333; -webkit-font-smoothing: antialiased; }
        table { border-collapse: collapse !important; }
        a { text-decoration: none !important; }

        /* Container */
        .wrapper { width: 100%; table-layout: fixed; background-color: #f4f4f7; padding-bottom: 40px; }
        .main { background-color: #ffffff; margin: 0 auto; width: 100%; max-width: 600px; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 15px rgba(0,0,0,0.05); }

        /* Header */
        .header { background-color: #ffffff; padding: 30px; text-align: center; border-bottom: 1px solid #eeeeee; }
        .logo { width: 140px; height: auto; }

        /* Body */
        .content { padding: 40px 35px; line-height: 1.6; text-align: left; }
        .greeting { font-size: 18px; font-weight: 600; color: #1a1a1a; margin-bottom: 15px; }
        .title { font-size: 24px; font-weight: 700; color: ${brandColor}; margin-bottom: 20px; line-height: 1.2; }
        .body-text { font-size: 16px; color: #555555; margin-bottom: 30px; }

        /* OTP Section */
        .otp-container { background-color: #fff0f6; border: 2px dashed ${brandColor}; border-radius: 12px; padding: 25px; text-align: center; margin: 30px 0; }
        .otp-label { display: block; font-size: 12px; text-transform: uppercase; letter-spacing: 2px; color: #888888; margin-bottom: 10px; font-weight: bold; }
        .otp-code { font-size: 36px; font-weight: 800; letter-spacing: 10px; color: ${brandColor}; margin: 0; }

        /* Button */
        .btn-wrapper { text-align: center; margin: 35px 0; }
        .btn { background-color: ${brandColor}; color: #ffffff !important; padding: 14px 35px; font-size: 16px; font-weight: 600; border-radius: 8px; display: inline-block; transition: background-color 0.3s; }

        /* Footer */
        .footer { padding: 30px; text-align: center; font-size: 13px; color: #999999; background-color: #fafafa; }
        .footer p { margin: 5px 0; }
        .social-links { margin-top: 20px; }
        .social-links a { color: ${brandColor}; font-weight: bold; margin: 0 10px; }

        /* Responsive */
        @media screen and (max-width: 600px) {
            .content { padding: 30px 20px; }
            .main { width: 95% !important; margin: 20px auto; }
        }
    </style>
</head>
<body>
    <div class="wrapper">
        <center>
            <div style="height: 40px;">&nbsp;</div>
            <table class="main" role="presentation">
                <!-- Header -->
                <tr>
                    <td class="header">
                        <img src="${logoUrl}" alt="WePlan Logo" class="logo">
                    </td>
                </tr>

                <!-- Content Area -->
                <tr>
                    <td class="content">
                        <div class="greeting">Hi ${userName},</div>
                        <div class="title">${title}</div>
                        <div class="body-text">${body}</div>

                        <!-- Conditionally render OTP -->
                        ${
                          otpCode
                            ? `
                        <div class="otp-container">
                            <span class="otp-label">Verification Code</span>
                            <div class="otp-code">${otpCode}</div>
                            <p style="font-size: 13px; color: #888; margin-top: 15px;">Valid for the next 10 minutes.</p>
                        </div>
                        `
                            : ""
                        }

                        <!-- Conditionally render Button -->
                        ${
                          buttonText && buttonLink
                            ? `
                        <div class="btn-wrapper">
                            <a href="${buttonLink}" class="btn">${buttonText}</a>
                        </div>
                        `
                            : ""
                        }

                        <p style="font-size: 15px; color: #666; margin-top: 30px;">
                            Warm regards,<br>
                            <strong>Team WePlan</strong>
                        </p>
                    </td>
                </tr>

                <!-- Footer -->
                <tr>
                    <td class="footer">
                        <p>Crafting Your Perfect Wedding Story.</p>
                        <p>&copy; ${new Date().getFullYear()} WePlan. All rights reserved.</p>
                        <div class="social-links">
                            <a href="#">Facebook</a> | <a href="#">Instagram</a> | <a href="#">Twitter</a>
                        </div>
                        <p style="margin-top: 15px; font-size: 11px;">You are receiving this email because you registered on our platform. If this wasn't you, please ignore this email.</p>
                    </td>
                </tr>
            </table>
            <div style="height: 40px;">&nbsp;</div>
        </center>
    </div>
</body>
</html>
    `;
};