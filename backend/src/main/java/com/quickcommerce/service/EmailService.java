package com.quickcommerce.service;

import com.quickcommerce.entity.Order;
import com.quickcommerce.entity.PaymentTransaction;
import com.quickcommerce.entity.User;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.mail.javamail.JavaMailSender;
import org.springframework.mail.javamail.MimeMessageHelper;
import org.springframework.core.io.ClassPathResource;
import org.springframework.stereotype.Service;
import org.springframework.web.util.HtmlUtils;

import jakarta.mail.internet.MimeMessage;

import java.util.concurrent.CompletableFuture;

@Slf4j
@Service
@RequiredArgsConstructor
public class EmailService {

    private final JavaMailSender mailSender;

    @Value("${app.notifications.enabled:false}")
    private boolean enabled;

    @Value("${app.notifications.from:${spring.mail.username:no-reply@quickcart.com}}")
    private String from;

    @Value("${spring.mail.username:}")
    private String smtpUsername;

    @Value("${app.notifications.logo-url:}")
    private String logoUrl;

    @Value("${app.frontend-url:http://localhost:3000}")
    private String frontendUrl;

    public void sendWelcome(User user) {
        if (!enabled) return;
        String name = escape(user.getFullName());
        String body = """
                <h2 style="color:#1f2937;margin:0 0 12px">Welcome to QuickCart, %s!</h2>
                <p>Thank you for registering. Your account is now ready, and we are excited to help you get groceries and essentials delivered quickly.</p>
                <p style="margin-top:24px"><a href="%s" style="background:#16a34a;color:#fff;padding:12px 20px;border-radius:6px;text-decoration:none;font-weight:bold">Start shopping</a></p>
                """.formatted(name, escape(frontendUrl));
        send(user.getEmail(), "Welcome to QuickCart — your account is ready", body);
    }

    public void sendOrderConfirmation(Order order, PaymentTransaction transaction) {
        if (!enabled) return;
        String paymentId = transaction != null && transaction.getGatewayPaymentId() != null
                ? transaction.getGatewayPaymentId() : "—";
        String gatewayOrderId = transaction != null && transaction.getGatewayOrderId() != null
                ? transaction.getGatewayOrderId() : (order.getPaymentReference() != null ? order.getPaymentReference() : "—");
        String body = """
                <h2 style="color:#1f2937;margin:0 0 12px">Payment successful — thank you!</h2>
                <p>Hi %s, we have received your payment and your order is confirmed.</p>
                <table role="presentation" width="100%%" cellpadding="0" cellspacing="0" style="background:#f8fafc;border-radius:8px;margin:20px 0">
                  <tr><td style="padding:12px;border-bottom:1px solid #e2e8f0"><strong>Order ID</strong></td><td style="padding:12px;border-bottom:1px solid #e2e8f0">%s</td></tr>
                  <tr><td style="padding:12px;border-bottom:1px solid #e2e8f0"><strong>Amount paid</strong></td><td style="padding:12px;border-bottom:1px solid #e2e8f0">₹%s</td></tr>
                  <tr><td style="padding:12px;border-bottom:1px solid #e2e8f0"><strong>Payment ID / UTR</strong></td><td style="padding:12px;border-bottom:1px solid #e2e8f0">%s</td></tr>
                  <tr><td style="padding:12px"><strong>Gateway order ID</strong></td><td style="padding:12px">%s</td></tr>
                </table>
                <p>We will keep you updated as your order moves through each delivery stage.</p>
                <p style="margin-top:24px"><a href="%s/orders/%d" style="background:#16a34a;color:#fff;padding:12px 20px;border-radius:6px;text-decoration:none;font-weight:bold">View order</a></p>
                """.formatted(escape(order.getUser().getFullName()), escape(order.getOrderNumber()),
                escape(order.getTotalAmount().toPlainString()), escape(paymentId), escape(gatewayOrderId),
                escape(frontendUrl), order.getId());
        send(order.getUser().getEmail(), "Order " + order.getOrderNumber() + " confirmed — payment successful", body);
    }

    /** Builds the message on the caller's thread, then hands SMTP delivery to a background thread so a slow mail server never blocks checkout or sign-up. */
    private void send(String recipient, String subject, String content) {
        MimeMessage message;
        try {
            message = mailSender.createMimeMessage();
            MimeMessageHelper helper = new MimeMessageHelper(message, true, "UTF-8");
            helper.setFrom(resolveSender());
            helper.setTo(recipient);
            helper.setSubject(subject);
            helper.setText(html(content), true);
            helper.addInline("quickcart-header", new ClassPathResource("quickcart-email-header.png"), "image/png");
        } catch (Exception ex) {
            log.error("Could not build email '{}' to {}", subject, recipient, ex);
            return;
        }
        CompletableFuture.runAsync(() -> {
            try {
                mailSender.send(message);
                log.info("Sent email '{}' to {}", subject, recipient);
            } catch (Exception ex) {
                log.error("Could not send email '{}' to {}", subject, recipient, ex);
            }
        });
    }

    private String resolveSender() {
        if (from == null || from.isBlank() || from.equals("no-reply@yourcompany.com") ||
                (smtpUsername != null && !smtpUsername.isBlank() && "smtp.gmail.com".equalsIgnoreCase(System.getenv("MAIL_HOST")))) {
            return smtpUsername != null && !smtpUsername.isBlank() ? smtpUsername : from;
        }
        return from;
    }

    private String html(String content) {
        String resolvedLogo = logoUrl.isBlank() ? "cid:quickcart-header" : logoUrl;
        String logo = "<img src=\"" + escape(resolvedLogo) + "\" alt=\"QuickCart - Fresh groceries, faster\" width=\"620\" style=\"display:block;width:100%;height:auto;border:0\">";
        return """
                <!doctype html><html><body style="margin:0;background:#f1f5f9;font-family:Arial,sans-serif;color:#334155">
                <table role="presentation" width="100%%" cellpadding="0" cellspacing="0" style="background:#f1f5f9;padding:24px 0">
                  <tr><td align="center"><table role="presentation" width="620" cellpadding="0" cellspacing="0" style="max-width:620px;background:#fff;border-radius:10px;overflow:hidden">
                    <tr><td style="padding:20px 32px;border-bottom:1px solid #e2e8f0">%s</td></tr>
                    <tr><td style="padding:32px;line-height:1.6">%s</td></tr>
                    <tr><td style="padding:24px 32px;background:#0f172a;color:#cbd5e1;font-size:13px;text-align:center">
                      <p style="margin:0 0 8px;color:#fff;font-weight:bold">Fresh groceries. Fast, reliable delivery.</p>
                      <p style="margin:0 0 14px">Groceries • Fresh food • Daily essentials</p>
                      <p style="margin:0 0 14px">
                        <a href="%s" style="color:#86efac;text-decoration:none;margin:0 8px">QuickCart</a>
                        <a href="https://www.facebook.com" style="color:#86efac;text-decoration:none;margin:0 8px">Facebook</a>
                        <a href="https://www.instagram.com" style="color:#86efac;text-decoration:none;margin:0 8px">Instagram</a>
                        <a href="https://www.linkedin.com" style="color:#86efac;text-decoration:none;margin:0 8px">LinkedIn</a>
                      </p>
                      <p style="margin:0;color:#94a3b8">© QuickCart. All rights reserved.</p>
                    </td></tr>
                  </table></td></tr>
                </table></body></html>
                """.formatted(logo, content, escape(frontendUrl));
    }

    private static String escape(String value) {
        return HtmlUtils.htmlEscape(value == null ? "" : value);
    }
}
