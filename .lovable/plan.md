# Menu order: About Izenzo before Trades

## What changes

In the public top menu, move **About** so it sits immediately before **Trades**, at the end of the menu list.

New order:

```text
Live Workspace | How It Works | The Intelligence Fabric | Pricing | About | Trades
```

Everything else stays as it is: same links, same pages, same styling, and the mobile/compact menu follows the same order.

## Technical note

`NAV` in `src/components/layout/AlphaBravoShell.tsx` currently lists the About entry second. Move `{ to: "/alpha-bravo/about", label: "About" }` to the last position in that array, so it renders just before the separately rendered Trades link.
