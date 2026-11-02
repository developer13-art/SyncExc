import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeAll, describe, expect, it, vi } from 'vitest';

import { OrderConfirmationModal } from './OrderConfirmationModal.jsx';

const order = {
  side: 'buy',
  type: 'market',
  quantity: '0.1',
};

const account = {
  id: 'account-1',
  label: 'Example Exchange · Production · Spot',
  exchangeName: 'Example Exchange',
  environment: 'production',
  type: 'spot',
  connectionId: 'connection-1',
  status: 'active',
};

const instrument = {
  symbol: 'BTCUSDT',
  baseAsset: 'BTC',
  quoteAsset: 'USDT',
  marketType: 'spot',
};

beforeAll(() => {
  HTMLElement.prototype.hasPointerCapture = () => false;
  HTMLElement.prototype.setPointerCapture = () => {};
  HTMLElement.prototype.releasePointerCapture = () => {};
  HTMLElement.prototype.scrollIntoView = () => {};
});

describe('OrderConfirmationModal universal destination selection', () => {
  it('requires the user to select a destination and compatible instrument before submission', async () => {
    const user = userEvent.setup();
    const onDestinationAccountChange = vi.fn();

    render(
      <OrderConfirmationModal
        open
        order={order}
        instrument={instrument}
        destinationAccounts={[account]}
        destinationMarketsLoading={false}
        onDestinationAccountChange={onDestinationAccountChange}
        universalMode
        onConfirm={vi.fn()}
      />,
    );

    expect(screen.getByText('Execution destination')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Submit order' })).toBeDisabled();
    await user.click(screen.getByRole('combobox'));
    await user.click(await screen.findByRole('option', { name: /Example Exchange/ }));
    expect(onDestinationAccountChange).toHaveBeenCalledWith(account.id);
  });

  it('enables submission after one eligible destination is resolved', () => {
    render(
      <OrderConfirmationModal
        open
        order={order}
        instrument={instrument}
        destinationAccounts={[account]}
        account={account}
        destinationAccountId={account.id}
        destinationInstrument={instrument}
        universalMode
        onConfirm={vi.fn()}
      />,
    );

    expect(screen.getByText('Example Exchange · production · spot')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Submit order' })).toBeEnabled();
  });
});
