# Kenyan Shilling + Fixed Sidebar Update

## Currency
All shared monetary displays on the Dashboard, Proposals, and Reports now use Kenyan Shillings.

The shared formatter is in:

`lib/currency.ts`

Use `formatCurrency(value)` for future monetary UI. It formats values as KSh/KES using the Kenyan locale.

## Sidebar
On desktop (`lg` and above), the sidebar is fixed to the left side of the viewport.

- Main content scrolls independently with the page.
- Navigation can scroll inside the sidebar if it becomes taller than the available viewport.
- The profile/account section remains pinned to the bottom of the sidebar.

No database migration is required.
