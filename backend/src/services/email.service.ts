import { env } from '../config/env.js';
import { logger } from '../utils/logger.js';
import { auditService } from './audit.service.js';

export interface EmailRecipient {
  email: string;
  name?: string;
}

class EmailService {
  private readonly brevoApiUrl = 'https://api.brevo.com/v3/smtp/email';

  /**
   * Sends transactional email using Brevo REST API
   */
  public async sendEmail(params: {
    to: EmailRecipient[];
    subject: string;
    htmlContent: string;
    textContent?: string;
    tag?: string;
  }): Promise<{ success: boolean; messageId?: string; error?: string }> {
    const apiKey = env.BREVO_API_KEY;

    if (!apiKey) {
      logger.info(`[BREVO EMAIL SIMULATOR] API key not configured. Logging notification for ${params.to[0].email}: "${params.subject}"`);
      return {
        success: false,
        error: 'BREVO_API_KEY is not configured in backend/.env. Add your Brevo API key to enable live delivery.',
      };
    }

    try {
      const payload = {
        sender: {
          name: env.BREVO_SENDER_NAME,
          email: env.BREVO_SENDER_EMAIL,
        },
        to: params.to.map((r) => ({
          email: r.email,
          name: r.name || r.email.split('@')[0],
        })),
        subject: params.subject,
        htmlContent: params.htmlContent,
        textContent: params.textContent || params.subject,
        tags: params.tag ? [params.tag] : ['emergency-system'],
      };

      const response = await fetch(this.brevoApiUrl, {
        method: 'POST',
        headers: {
          'accept': 'application/json',
          'api-key': apiKey,
          'content-type': 'application/json',
        },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(`Brevo API returned ${response.status}: ${JSON.stringify(errorData)}`);
      }

      const data = (await response.json()) as any;
      logger.info(`Brevo email successfully dispatched to ${params.to[0].email}`, { messageId: data.messageId });

      await auditService.log({
        action: 'EMAIL_NOTIFICATION_SENT',
        entityType: 'Notification',
        metadata: {
          recipient: params.to[0].email,
          subject: params.subject,
          tag: params.tag,
          messageId: data.messageId,
        },
      });

      return { success: true, messageId: data.messageId };
    } catch (err: any) {
      logger.error('Failed to send email via Brevo API', { error: err.message, to: params.to });
      return { success: false, error: err.message };
    }
  }

  /**
   * Template: Emergency Request Received Confirmation
   */
  public async sendEmergencyConfirmation(
    toEmail: string,
    callerName: string,
    caseNumber: string,
    priority: string,
    pickupAddress: string,
    trackingUrl: string
  ) {
    const html = `
      <div style="font-family: Arial, sans-serif; background-color: #0a0f1d; color: #f1f5f9; padding: 24px; border-radius: 12px; max-width: 600px; margin: 0 auto; border: 1px solid #1e294b;">
        <div style="border-bottom: 2px solid #06b6d4; padding-bottom: 12px; margin-bottom: 20px;">
          <h2 style="color: #22d3ee; margin: 0; font-size: 22px;">Emergency Response Logged</h2>
          <p style="color: #94a3b8; font-size: 13px; margin: 4px 0 0 0;">AmbulanceOps Emergency Dispatch & Coordination System</p>
        </div>
        <p style="font-size: 15px;">Hello <strong>${callerName}</strong>,</p>
        <p style="font-size: 14px; line-height: 1.5; color: #cbd5e1;">Your emergency request has been received by our automated CAD dispatch system. Nearest available response units are being evaluated for immediate dispatch.</p>
        
        <div style="background-color: #0f172a; border-left: 4px solid #ea580c; padding: 14px; margin: 16px 0; border-radius: 6px;">
          <p style="margin: 3px 0; font-size: 13px;"><strong>Incident Number:</strong> <span style="font-family: monospace; color: #38bdf8;">${caseNumber}</span></p>
          <p style="margin: 3px 0; font-size: 13px;"><strong>Triage Urgency:</strong> <span style="color: #f87171; font-weight: bold;">${priority}</span></p>
          <p style="margin: 3px 0; font-size: 13px;"><strong>Pickup Location:</strong> ${pickupAddress}</p>
        </div>

        <div style="margin: 24px 0; text-align: center;">
          <a href="${trackingUrl}" style="background-color: #06b6d4; color: #0a0f1d; font-weight: bold; padding: 12px 24px; text-decoration: none; border-radius: 8px; display: inline-block; font-size: 14px;">
            Track Ambulance in Real-Time
          </a>
        </div>

        <p style="font-size: 12px; color: #64748b; line-height: 1.4;">If patient condition deteriorates, or if you need to provide gate access/apartment codes, open the tracking link above or contact emergency coordination directly.</p>
      </div>
    `;

    return this.sendEmail({
      to: [{ email: toEmail, name: callerName }],
      subject: `[EMERGENCY ACKNOWLEDGED] Incident ${caseNumber} (${priority})`,
      htmlContent: html,
      tag: 'emergency-confirmation',
    });
  }

  /**
   * Template: Ambulance Dispatched & En Route Alert
   */
  public async sendAmbulanceDispatched(
    toEmail: string,
    callerName: string,
    caseNumber: string,
    callSign: string,
    etaMinutes: number,
    paramedicName?: string,
    paramedicPhone?: string,
    trackingUrl?: string
  ) {
    const html = `
      <div style="font-family: Arial, sans-serif; background-color: #0a0f1d; color: #f1f5f9; padding: 24px; border-radius: 12px; max-width: 600px; margin: 0 auto; border: 1px solid #1e294b;">
        <div style="border-bottom: 2px solid #10b981; padding-bottom: 12px; margin-bottom: 20px;">
          <h2 style="color: #34d399; margin: 0; font-size: 22px;">Ambulance Dispatched & En Route</h2>
          <p style="color: #94a3b8; font-size: 13px; margin: 4px 0 0 0;">Unit has departed and is responding to your location</p>
        </div>

        <div style="background-color: #064e3b; border: 1px solid #10b981; padding: 16px; border-radius: 8px; text-align: center; margin: 16px 0;">
          <span style="font-size: 12px; color: #a7f3d0; text-transform: uppercase; font-weight: bold;">Estimated Arrival Time</span>
          <div style="font-size: 32px; font-weight: bold; color: #ffffff; font-family: monospace;">~${etaMinutes} MINS</div>
          <span style="font-size: 12px; color: #a7f3d0;">Assigned Unit: <strong>${callSign}</strong></span>
        </div>

        ${paramedicName ? `
        <div style="background-color: #0f172a; padding: 14px; border-radius: 6px; margin: 16px 0; border: 1px solid #1e294b;">
          <p style="margin: 0; font-size: 13px;"><strong>Lead Paramedic:</strong> ${paramedicName}</p>
          ${paramedicPhone ? `<p style="margin: 4px 0 0 0; font-size: 13px;"><strong>Direct Crew Phone:</strong> <a href="tel:${paramedicPhone}" style="color: #22d3ee;">${paramedicPhone}</a></p>` : ''}
        </div>
        ` : ''}

        ${trackingUrl ? `
        <div style="margin: 24px 0; text-align: center;">
          <a href="${trackingUrl}" style="background-color: #10b981; color: #0a0f1d; font-weight: bold; padding: 12px 24px; text-decoration: none; border-radius: 8px; display: inline-block; font-size: 14px;">
            Open Live GPS Map
          </a>
        </div>
        ` : ''}
      </div>
    `;

    return this.sendEmail({
      to: [{ email: toEmail, name: callerName }],
      subject: `[UNIT EN ROUTE] Ambulance ${callSign} dispatched to your location (~${etaMinutes} mins)`,
      htmlContent: html,
      tag: 'ambulance-dispatched',
    });
  }

  /**
   * Template: Hospital Acceptance & Trauma Bed Reserved Alert
   */
  public async sendHospitalAccepted(
    toEmail: string,
    callerName: string,
    caseNumber: string,
    hospitalName: string,
    hospitalAddress: string,
    hospitalPhone: string,
    trackingUrl: string
  ) {
    const html = `
      <div style="font-family: Arial, sans-serif; background-color: #0a0f1d; color: #f1f5f9; padding: 24px; border-radius: 12px; max-width: 600px; margin: 0 auto; border: 1px solid #1e294b;">
        <div style="border-bottom: 2px solid #06b6d4; padding-bottom: 12px; margin-bottom: 20px;">
          <h2 style="color: #22d3ee; margin: 0; font-size: 22px;">Hospital Bed & Trauma Team Prepared</h2>
          <p style="color: #94a3b8; font-size: 13px; margin: 4px 0 0 0;">Receiving facility has confirmed inbound coordination</p>
        </div>

        <p style="font-size: 15px;">Hello <strong>${callerName}</strong>,</p>
        <p style="font-size: 14px; line-height: 1.5; color: #cbd5e1;">Emergency medical center <strong>${hospitalName}</strong> has officially accepted transfer of Incident <strong>${caseNumber}</strong>. Trauma beds and clinical staff have been placed on emergency standby.</p>

        <div style="background-color: #0f172a; border-left: 4px solid #06b6d4; padding: 14px; margin: 16px 0; border-radius: 6px;">
          <p style="margin: 3px 0; font-size: 13px;"><strong>Destination Facility:</strong> ${hospitalName}</p>
          <p style="margin: 3px 0; font-size: 13px;"><strong>Facility Address:</strong> ${hospitalAddress}</p>
          <p style="margin: 3px 0; font-size: 13px;"><strong>Emergency Contact:</strong> <a href="tel:${hospitalPhone}" style="color: #38bdf8;">${hospitalPhone}</a></p>
        </div>

        <div style="margin: 24px 0; text-align: center;">
          <a href="${trackingUrl}" style="background-color: #06b6d4; color: #0a0f1d; font-weight: bold; padding: 12px 24px; text-decoration: none; border-radius: 8px; display: inline-block; font-size: 14px;">
            View Real-Time Routing Map
          </a>
        </div>
      </div>
    `;

    return this.sendEmail({
      to: [{ email: toEmail, name: callerName }],
      subject: `[HOSPITAL READY] ${hospitalName} confirmed inbound emergency (${caseNumber})`,
      htmlContent: html,
      tag: 'hospital-accepted',
    });
  }

  /**
   * Template: Staff Invitation with Cryptographic Token
   */
  public async sendStaffInvitation(
    toEmail: string,
    role: string,
    inviteUrl: string,
    expiresAt: Date
  ) {
    const html = `
      <div style="font-family: Arial, sans-serif; background-color: #0a0f1d; color: #f1f5f9; padding: 24px; border-radius: 12px; max-width: 600px; margin: 0 auto; border: 1px solid #1e294b;">
        <h2 style="color: #22d3ee; margin: 0 0 12px 0;">Official Personnel Invitation</h2>
        <p style="font-size: 14px; color: #cbd5e1;">You have been invited to join the <strong>AmbulanceOps Emergency Coordination Platform</strong> with privileged role:</p>
        
        <div style="background-color: #0f172a; padding: 12px; border-radius: 6px; font-weight: bold; color: #38bdf8; font-family: monospace; font-size: 14px; margin: 14px 0;">
          ROLE: ${role}
        </div>

        <p style="font-size: 13px; color: #94a3b8;">This invitation link expires on <strong>${expiresAt.toUTCString()}</strong>.</p>

        <div style="margin: 24px 0;">
          <a href="${inviteUrl}" style="background-color: #06b6d4; color: #0a0f1d; font-weight: bold; padding: 12px 24px; text-decoration: none; border-radius: 8px; display: inline-block; font-size: 14px;">
            Activate Account & Set Password
          </a>
        </div>
      </div>
    `;

    return this.sendEmail({
      to: [{ email: toEmail }],
      subject: `[STAFF INVITATION] Authorized Emergency Platform Activation (${role})`,
      htmlContent: html,
      tag: 'staff-invitation',
    });
  }
}

export const emailService = new EmailService();
