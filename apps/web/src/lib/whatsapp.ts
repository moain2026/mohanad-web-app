/**
 * WhatsApp Deep Link generator (Phase 3 — B5).
 *
 * Builds a https://wa.me/<phone>?text=<msg> URL using the customer's
 * preferred WhatsApp phone (falls back to phone), strips non-digits,
 * and substitutes {variables} in the template.
 *
 * Templates use mustache-light syntax: "{name}, دينك الحالي {balance} ريال".
 * If a variable is missing it is rendered verbatim ("{name}") so the
 * sender notices and can fix the template.
 */

export interface WhatsAppCustomerLike {
  phone?: string | null;
  whatsappPhone?: string | null;
}

/** Strip all non-digit characters; keep leading + by re-adding if needed. */
function normalizePhone(raw: string | null | undefined): string {
  if (!raw) return '';
  return raw.replace(/\D/g, '');
}

/**
 * Substitute `{variable}` placeholders. Missing variables are kept
 * verbatim (with braces) so the template author notices the gap.
 */
export function applyTemplate(template: string, vars: Record<string, string | number>): string {
  return template.replace(/\{(\w+)\}/g, (_match, key: string) => {
    if (Object.prototype.hasOwnProperty.call(vars, key)) {
      return String(vars[key]);
    }
    return `{${key}}`;
  });
}

/**
 * Generate a wa.me link. Returns `null` if the customer has no usable phone.
 */
export function generateWhatsAppLink(
  customer: WhatsAppCustomerLike,
  template: string,
  vars: Record<string, string | number> = {},
): string | null {
  const message = applyTemplate(template, vars);
  const phone = normalizePhone(customer.whatsappPhone || customer.phone || '');
  if (!phone) return null;
  return `https://wa.me/${phone}?text=${encodeURIComponent(message)}`;
}

/** Common templates for customer reminders / receipts. */
export const WHATSAPP_TEMPLATES = {
  debtReminder: 'مرحباً {name}، نُذكِّركم بأن المبلغ المستحق لدى البقالة هو {balance} ريال. شكراً لكم.',
  paymentReceipt:
    'مرحباً {name}، تم استلام دفعة بقيمة {amount} ريال. الرصيد المتبقي: {balance} ريال. شكراً لكم.',
  saleReceipt: 'مرحباً {name}، إيصال بيع رقم {receipt} بقيمة {total} ريال. شكراً لكم.',
} as const;
