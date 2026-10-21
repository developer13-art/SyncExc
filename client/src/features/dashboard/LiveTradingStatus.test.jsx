import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, test } from 'vitest';
import { LiveTradingStatus } from './LiveTradingStatus.jsx';

describe('LiveTradingStatus', () => {
  test('counts submitted and partially filled orders as pending', () => {
    render(
      <MemoryRouter>
        <LiveTradingStatus
          orders={[
            { id: 'order-1', status: 'submitted' },
            { id: 'order-2', status: 'partially_filled' },
            { id: 'order-3', status: 'filled' },
          ]}
        />
      </MemoryRouter>,
    );

    expect(screen.getByText('2')).toBeInTheDocument();
  });
});
