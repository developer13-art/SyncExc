# Market types, order types, and TP/SL protection

## Canonical market model

- `spot`: unleveraged asset ownership (1x); no futures liquidation model.
- `futures`: leveraged derivatives, including perpetual contracts. Perpetuals
  normalize to `futures` for capability and instrument checks.
- Entry order types are `market` and `limit`. Conditional exit order types are
  separate adapter operations, not alternate names for entry orders.
- A market order requests immediate execution at the best available price. A
  limit order requires an explicit price and may remain unfilled.

Spot execution does not apply the signal's futures leverage. Futures sizing and
margin checks use account equity/margin and the requested leverage.

## Protection matrix

| Market | Entry type | Required TP/SL behavior |
| --- | --- | --- |
| Spot | Market | Reject unless the adapter explicitly declares supported exchange-managed protection. Do not silently rewrite it as a limit order or remove TP/SL. |
| Spot | Limit | Allow only an explicitly declared entry-attached conditional bracket for that order type, or a future fill-confirmed protection coordinator. |
| Futures/perpetual | Market | Allow only when the adapter declares native position protection for market entries. |
| Futures/perpetual | Limit | Allow only when the adapter declares native position protection for limit entries. |

When protection is requested, both stop-loss and take-profit are required. If
neither is requested, normal entry validation still applies. Unsupported
protection is rejected at the terminal API or recorded as a per-destination
skip for signal and copy execution; the request is never submitted unprotected.

## Adapter capability contract

Adapters should declare `capabilities.bracketProtection` by market:

```js
{
  spot: {
    nativePositionOrderTypes: [],
    entryAttachedConditionalOrderTypes: ['limit'],
    postFillConditionalOrderTypes: [],
  },
  futures: {
    nativePositionOrderTypes: ['market', 'limit'],
    entryAttachedConditionalOrderTypes: [],
    postFillConditionalOrderTypes: [],
  },
}
```

Only `nativePositionOrderTypes` and Spot
`entryAttachedConditionalOrderTypes` are currently executable. Advertising
`postFillConditionalOrderTypes` does not enable execution: until a coordinator
waits for a confirmed fill, submits conditional exits, tracks their IDs, and
reconciles/cancels them with the entry, validation rejects that route.

The policy resolver supports the legacy
`hasAttachedBracketProtectionMarkets` /
`hasAttachedBracketProtectionOrderTypes` declaration while adapters migrate.
New adapters should use the explicit contract above. Capability claims must
match the fields their `placeOrder` implementation actually sends.

## Current adapter declarations

- Bybit: native Futures/Perpetual market and limit protection; Spot Limit
  entry-attached conditional protection; no Spot Market bracket support.
- Binance, OKX, and Bitget currently declare no executable bracket capability.
  They are skipped/rejected for TP/SL-protected routes until their adapters
  implement and declare a verified exchange payload or a fill-confirmed
  emulation flow.

## Honest execution states

- Pre-trade incompatibility: no order is submitted; persist an explicit
  protection or order-type skip reason and emit a warning.
- Clear exchange rejection: persist the rejected state and exchange reason;
  never report the destination as submitted.
- Timeout or ambiguous response: persist `reconciliation_required`; do not
  retry automatically or report success.
- Risk approval pending: persist `awaiting_confirmation`; do not call it an
  exchange submission.

Trader execution, marketplace copying, and direct terminal orders all use the
same protection resolver before order dispatch. The exchange adapter repeats
the check as a final guard.
