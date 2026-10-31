# LIVE LINK - https://frabjous-daffodil-daa433.netlify.app/
 # LIVE LINK Password - My-Drop-Site
 # Brightloop Login: admin@brightloop.demo | Password: Brightloop!2026
  

# Brightloop — Subscription Operations

A full-stack subscription operations app with a responsive browser UI, Express API, SQLite persistence, role-aware access, seeded demo workspace, recurring invoice generation and payment ledger.

## Run it locally

**Requirements:** Node.js 22.5 or newer (uses the built-in `node:sqlite` module).

1. Extract the ZIP.
2. On macOS, double-click `START_MAC.command`. On Windows, double-click `START_WINDOWS.bat`. The launcher installs dependencies on first run, creates a local secret and starts the app.
3. Or open a terminal in the `brightloop_fullstack` folder and run:
   ```bash
   npm install
   cp .env.example .env
   # Set JWT_SECRET to a random value of at least 32 characters.
   npm start
   ```
4. Open **http://localhost:4000**. Do not double-click `public/index.html`; the frontend calls the API served by the local server. `DATABASE_FILE` defaults to `./data/brightloop.sqlite`.

The database and sample workspace are created automatically on first launch. Keep the `data/` directory to retain your records.

## Demo accounts

All demo accounts use `Brightloop!2026`.

| Role | Email |
|---|---|
| Admin | `admin@brightloop.demo` |
| Staff | `staff@brightloop.demo` |
| Customer portal | `customer@brightloop.demo` |

Public sign-up always creates a customer account. Only an admin can create staff users. Customers can only see their own subscriptions, invoices and payments.

## Included workflows

- Unique email sign-up, password policy, bcrypt password hashes, JWT sessions and role checks.
- Password reset token generation with 30-minute expiry and one-time use. In local development, the reset URL is returned in the response and printed to the server console. Configure an email provider before production to deliver reset emails.
- Admin product and variant catalogue, plans with daily/weekly/monthly/yearly intervals, quantity and lifecycle settings.
- Customer directory, subscription lifecycle and quote-template records.
- Billing run for all active subscriptions whose next billing date is due. Duplicate invoices are guarded within the billing run window. Discounts can be applied to subscription invoices when active, eligible and within their usage cap.
- Invoice tax calculation from subscription line tax rates; tax rules are available for new subscriptions.
- Invoice confirmation/cancellation, send-state action, outstanding balance and payment recording with overpayment protection.
- Dashboard metrics, six-month collections summary, overdue invoice reporting and searchable lists.
- SQLite indexes and WAL mode for a compact local deployment and concurrent reads.

## Main API routes

- `GET /api/health`, `GET /api/overview`, `GET /api/reports`
- `/api/auth/signup`, `/api/auth/login`, `/api/auth/me`, `/api/auth/forgot`, `/api/auth/reset`, `/api/auth/staff`
- `/api/customers`, `/api/products`, `/api/plans`, `/api/subscriptions`
- `/api/invoices`, `/api/payments`, `/api/discounts`, `/api/taxes`, `/api/quote-templates`
- `POST /api/billing/run`

Authenticated routes use `Authorization: Bearer <token>`.

## Production deployment checklist

This is a runnable local full-stack application and starter, not a deployed production service. Before handling real customer or payment data:

- Use a managed database and persistent encrypted storage/backups; SQLite is intended for local/single-instance use.
- Set a strong secret, HTTPS, production CORS policy, secure hosting, logging, monitoring and audit trails.
- Connect a transactional email provider for password resets and invoice delivery. The current “Send” action updates invoice state; it does not send email.
- Connect a payment provider (e.g. Razorpay or Stripe) with signed webhooks and server-side reconciliation. The current payment ledger records verified/manual payments; it does not collect card details.
- Configure billing scheduler to call `POST /api/billing/run` daily, and test timezone, retries, idempotency and proration rules for your contracts.
- Have local tax, invoicing, privacy and accounting requirements reviewed before launch.

Never put real card data or production credentials into the demo environment.
