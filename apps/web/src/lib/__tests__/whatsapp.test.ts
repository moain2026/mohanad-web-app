import { describe, expect, it } from 'vitest';

import { WHATSAPP_TEMPLATES, applyTemplate, generateWhatsAppLink } from '@/lib/whatsapp';

describe('whatsapp deep-link util', () => {
  describe('applyTemplate', () => {
    it('substitutes simple variables', () => {
      expect(applyTemplate('hello {name}', { name: 'موعن' })).toBe('hello موعن');
    });

    it('keeps unknown variables verbatim', () => {
      expect(applyTemplate('{a} {b}', { a: '1' })).toBe('1 {b}');
    });

    it('coerces numbers to strings', () => {
      expect(applyTemplate('amount={x}', { x: 10.5 })).toBe('amount=10.5');
    });
  });

  describe('generateWhatsAppLink', () => {
    it('builds wa.me link from whatsappPhone preferred over phone', () => {
      const link = generateWhatsAppLink(
        { phone: '050-111-2222', whatsappPhone: '050-333-4444' },
        'hi {name}',
        { name: 'سامي' },
      );
      expect(link).toMatch(/^https:\/\/wa\.me\/0503334444\?text=/);
      expect(link).toContain(encodeURIComponent('hi سامي'));
    });

    it('falls back to phone when whatsappPhone missing', () => {
      const link = generateWhatsAppLink({ phone: '+966 50 111 2222', whatsappPhone: null }, 'msg');
      expect(link).toMatch(/^https:\/\/wa\.me\/966501112222\?text=/);
    });

    it('returns null when no phone available', () => {
      expect(generateWhatsAppLink({ phone: null, whatsappPhone: null }, 'msg')).toBeNull();
      expect(generateWhatsAppLink({}, 'msg')).toBeNull();
    });

    it('strips non-digits from phone', () => {
      const link = generateWhatsAppLink({ phone: '(05) 0-111 2222' }, 'x');
      expect(link).toMatch(/^https:\/\/wa\.me\/0501112222\?text=/);
    });

    it('substitutes variables inside default templates', () => {
      const link = generateWhatsAppLink({ phone: '0501112222' }, WHATSAPP_TEMPLATES.debtReminder, {
        name: 'علي',
        balance: '120.50',
      });
      expect(link).toContain(encodeURIComponent('علي'));
      expect(link).toContain(encodeURIComponent('120.50'));
    });
  });
});
