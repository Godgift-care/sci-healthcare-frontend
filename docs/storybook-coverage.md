# Storybook coverage

Every component in `src/components/` either has a story file or a reason here
why a story would not show anything a contributor could not see in the app.
`src/components/stories.test.tsx` renders every story and runs axe over it, so
a story that throws or introduces an accessibility violation fails
`npm run test:unit`.

## Components with stories

| Component | Story file | States |
| --- | --- | --- |
| `ui.tsx` (Button, Card, Alert, Empty, Field, StatusBadge, ExplorerLink, Tooltip, InfoTip, Modal) | `ui.stories.tsx` | variants, disabled, open modals, long content |
| `Toast.tsx` | `Toast.stories.tsx` | success, failure, long message |
| `CopyValue.tsx` | `CopyValue.stories.tsx` | address, known name, button-only, long hash |
| `DataTable.tsx` | `DataTable.stories.tsx` | sorted, empty, long content |
| `Skeleton.tsx` | `Skeleton.stories.tsx` | base block, list rows, cards |
| `VoucherRow.tsx` | `VoucherRow.stories.tsx` | the statuses a row can show |
| `TestUsdc.tsx` | `TestUsdc.stories.tsx` | the testnet faucet panel |

## Components without stories, and why

A story is a preview of a component in a state a reviewer can choose. These
components have no state of their own to choose, or cannot render without a
provider Storybook does not start, so their behaviour is covered by tests
(`src/components/*.test.tsx`) and the end-to-end suite instead.

| Component | Why no story |
| --- | --- |
| `SwrProvider.tsx` | a context provider with no visual output; every page uses it |
| `ServiceWorkerRegistration.tsx` | registers a service worker on mount, no UI |
| `ErrorReporter.tsx` | installs global error handlers, no UI |
| `Analytics.tsx`, `AnalyticsToggle.tsx` | depend on the site's analytics configuration and consent |
| `ConnectButton.tsx` | reads the wallet provider; the disconnected form is the only state Storybook can render, and `ConnectButton.test.tsx` covers the menu, connecting and low-balance states |
| `QrScannerModal.tsx`, `VoucherQr.tsx` | need a camera or a real voucher to show anything |
| `ClinicMap.tsx` | loads Leaflet on demand and needs network tiles; the map has its own end-to-end spec |
| `CommandPalette.tsx`, `DemoTour.tsx`, `SiteHeader.tsx`, `NetworkBadge.tsx`, `LanguageSwitcher.tsx`, `ThemeToggle.tsx`, `LowBandwidthToggle.tsx`, `FavouriteButton.tsx`, `AddressName.tsx`, `PendingTransactionGuard.tsx`, `WidgetBoundary.tsx` | page chrome driven by routing, the wallet or the theme; snapshotted in `tests/visual` on the pages they belong to |
| `ClinicChecklist.tsx`, `ClinicEarnings.tsx` (desk panels), `RecentVouchers.tsx`, `SavedPatientControls.tsx`, `Sep24Cashout.tsx`, `Sep7FundPanel.tsx`, `VerifyPatient.tsx` | page sections that fetch from the API; shown by the desktop and mobile visual snapshots, where their loading, empty and error states appear with real layout |

If one of these grows a state worth choosing (a new empty state, a new error
branch), give it a story and remove its row here.
