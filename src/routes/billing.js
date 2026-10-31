const router = require("express").Router();
const Stripe = require("stripe");
const prisma = require("../db");
const { allow } = require("../middleware");

router.post("/stripe/intent", async (req, res, next) => {
  try {
    if (!process.env.STRIPE_SECRET_KEY) return res.status(503).json({ error: "Online payments are not configured yet" });
    const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
    const invoice = await prisma.invoice.findUnique({ where: { id: req.body.invoiceId }, include: { customer: true } });
    if (!invoice || (req.user.role === "CUSTOMER" && invoice.customer.userId !== req.user.id)) return res.status(404).json({ error: "Invoice not found" });
    const due = Number(invoice.total) - Number(invoice.amountPaid);
    if (due <= 0) return res.status(400).json({ error: "Invoice has no outstanding balance" });
    const intent = await stripe.paymentIntents.create({
      amount: Math.round(due * 100), currency: "inr",
      automatic_payment_methods: { enabled: true },
      metadata: { invoiceId: invoice.id, customerId: invoice.customerId }
    }, { idempotencyKey: `brightloop-invoice-${invoice.id}-${due.toFixed(2)}` });
    res.json({ clientSecret: intent.client_secret, paymentIntentId: intent.id });
  } catch (e) { next(e); }
});

// Use Stripe webhook signature verification in production; never trust browser payment success.
router.post("/stripe/webhook-not-configured", (req, res) => res.status(501).json({ error: "Configure a raw-body Stripe webhook before enabling live payments" }));

module.exports = router;
