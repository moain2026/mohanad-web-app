import { MessageCircle } from 'lucide-react';

import { Button, type ButtonProps } from '@/components/ui';
import {
  WHATSAPP_TEMPLATES,
  type WhatsAppCustomerLike,
  generateWhatsAppLink,
} from '@/lib/whatsapp';

/**
 * WhatsAppButton — Phase 3 P3-B5.
 *
 * Generates a wa.me deep-link from the customer's phone + a template,
 * and opens it in a new tab. Disabled when the customer has no phone
 * (renders an explanatory tooltip via title).
 */
export interface WhatsAppButtonProps extends Omit<ButtonProps, 'onClick' | 'children'> {
  customer: WhatsAppCustomerLike & { name?: string };
  template?: string;
  /** Variables to interpolate into the template ({name}, {balance}, …). */
  vars?: Record<string, string | number>;
  label?: string;
}

export function WhatsAppButton({
  customer,
  template = WHATSAPP_TEMPLATES.debtReminder,
  vars,
  label = 'إرسال عبر واتساب',
  variant = 'secondary',
  size = 'sm',
  ...rest
}: WhatsAppButtonProps): JSX.Element {
  const link = generateWhatsAppLink(
    customer,
    template,
    vars ?? { name: customer.name ?? 'عميلنا الكريم' },
  );

  const disabled = !link;

  return (
    <Button
      variant={variant}
      size={size}
      leftIcon={<MessageCircle className="h-4 w-4" aria-hidden />}
      disabled={disabled}
      title={disabled ? 'لا يوجد رقم هاتف للعميل' : 'فتح محادثة واتساب'}
      data-testid="whatsapp-button"
      data-link={link ?? ''}
      onClick={() => {
        if (link) window.open(link, '_blank', 'noopener,noreferrer');
      }}
      {...rest}
    >
      {label}
    </Button>
  );
}
