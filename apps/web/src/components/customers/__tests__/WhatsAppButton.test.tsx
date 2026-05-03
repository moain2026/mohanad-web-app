import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { WhatsAppButton } from '@/components/customers/WhatsAppButton';

describe('WhatsAppButton', () => {
  it('renders enabled when customer has phone and opens link in new tab on click', async () => {
    const openSpy = vi.spyOn(window, 'open').mockImplementation(() => null);
    const user = userEvent.setup();

    render(<WhatsAppButton customer={{ name: 'علي', phone: '0501112222' }} template="hi {name}" />);
    const btn = screen.getByTestId('whatsapp-button');
    expect(btn).not.toBeDisabled();
    expect(btn.getAttribute('data-link')).toMatch(/^https:\/\/wa\.me\/0501112222\?text=/);

    await user.click(btn);
    expect(openSpy).toHaveBeenCalledOnce();
    const url = openSpy.mock.calls[0]?.[0] as string;
    expect(url).toContain(encodeURIComponent('hi علي'));

    openSpy.mockRestore();
  });

  it('disables when customer has no phone', () => {
    render(<WhatsAppButton customer={{ name: 'سامي', phone: null }} template="x" />);
    expect(screen.getByTestId('whatsapp-button')).toBeDisabled();
  });
});
