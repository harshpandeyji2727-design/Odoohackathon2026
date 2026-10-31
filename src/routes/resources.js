const router = require("express").Router();
const prisma = require("../db");
const { z } = require("zod");
const { allow } = require("../middleware");

const schemas = {
  products: z.object({ name: z.string().min(1), type: z.string().min(1), salesPrice: z.coerce.number().nonnegative(), costPrice: z.coerce.number().nonnegative(), notes: z.string().optional() }),
  plans: z.object({ name: z.string().min(1), description: z.string().optional(), price: z.coerce.number().nonnegative(), interval: z.enum(["DAILY","WEEKLY","MONTHLY","YEARLY"]), minQuantity: z.coerce.number().int().positive().default(1), autoClose: z.boolean().optional(), allowEarlyClose: z.boolean().optional(), allowPause: z.boolean().optional(), autoRenew: z.boolean().optional() }),
  customers: z.object({ name: z.string().min(1), email: z.email(), phone: z.string().optional(), company: z.string().optional(), billingAddress: z.string().optional(), taxId: z.string().optional() }),
  discounts: z.object({ name: z.string(), type: z.enum(["FIXED","PERCENTAGE"]), value: z.coerce.number().positive(), minPurchase: z.coerce.number().optional(), minQuantity: z.coerce.number().int().optional(), startsAt: z.coerce.date().optional(), endsAt: z.coerce.date().optional(), usageLimit: z.coerce.number().int().positive().optional(), productIds: z.array(z.string()).default([]), appliesToSubscriptions: z.boolean().default(false) })
};
const model = { products: "product", plans: "plan", customers: "customer", discounts: "discount" };
const adminStaff = allow("ADMIN", "STAFF");

for (const [path, delegate] of Object.entries(model)) {
  router.get(`/${path}`, ...(path === "customers" ? [adminStaff] : []), async (req, res, next) => {
    try { res.json(await prisma[delegate].findMany({ take: Math.min(Number(req.query.limit) || 100, 500), orderBy: { createdAt: "desc" } })); }
    catch (e) { next(e); }
  });
  router.post(`/${path}`, adminStaff, async (req, res, next) => {
    try { const data = schemas[path].parse(req.body); res.status(201).json(await prisma[delegate].create({ data })); }
    catch (e) { next(e); }
  });
  router.patch(`/${path}/:id`, adminStaff, async (req, res, next) => {
    try { const data = schemas[path].partial().parse(req.body); res.json(await prisma[delegate].update({ where: { id: req.params.id }, data })); }
    catch (e) { next(e); }
  });
  router.delete(`/${path}/:id`, allow("ADMIN"), async (req, res, next) => {
    try { await prisma[delegate].delete({ where: { id: req.params.id } }); res.status(204).end(); }
    catch (e) { next(e); }
  });
}

router.get("/subscriptions", async (req, res, next) => {
  try {
    const where = req.user.role === "CUSTOMER" ? { customer: { userId: req.user.id } } : {};
    res.json(await prisma.subscription.findMany({ where, include: { customer: true, plan: true, lines: { include: { product: true } } }, orderBy: { createdAt: "desc" } }));
  } catch (e) { next(e); }
});
router.post("/subscriptions", adminStaff, async (req, res, next) => {
  try {
    const d = z.object({ customerId: z.string(), planId: z.string(), startDate: z.coerce.date(), endDate: z.coerce.date().optional(), paymentTerms: z.string().optional(), quantity: z.coerce.number().int().positive().default(1), lines: z.array(z.object({ productId: z.string(), description: z.string().optional(), quantity: z.coerce.number().int().positive(), unitPrice: z.coerce.number().nonnegative(), taxRate: z.coerce.number().min(0).max(100).default(0) })).default([]) }).parse(req.body);
    const sub = await prisma.subscription.create({ data: { code: `BL-${Date.now()}`, customerId: d.customerId, planId: d.planId, startDate: d.startDate, endDate: d.endDate, paymentTerms: d.paymentTerms, quantity: d.quantity, nextBillingAt: d.startDate, lines: { create: d.lines } }, include: { customer: true, plan: true, lines: true } });
    res.status(201).json(sub);
  } catch (e) { next(e); }
});
router.patch("/subscriptions/:id/status", adminStaff, async (req, res, next) => {
  try { const status = z.enum(["DRAFT","QUOTATION","CONFIRMED","ACTIVE","PAUSED","CLOSED"]).parse(req.body.status); res.json(await prisma.subscription.update({ where: { id: req.params.id }, data: { status } })); }
  catch (e) { next(e); }
});

router.get("/invoices", async (req, res, next) => {
  try {
    const where = req.user.role === "CUSTOMER" ? { customer: { userId: req.user.id } } : {};
    res.json(await prisma.invoice.findMany({ where, include: { customer: true, lines: true, payments: true }, orderBy: { issueDate: "desc" } }));
  } catch (e) { next(e); }
});
router.patch("/invoices/:id/status", adminStaff, async (req, res, next) => {
  try { const status = z.enum(["CONFIRMED","CANCELLED"]).parse(req.body.status); res.json(await prisma.invoice.update({ where: { id: req.params.id }, data: { status } })); }
  catch (e) { next(e); }
});
router.get("/payments", async (req, res, next) => {
  try {
    const where = req.user.role === "CUSTOMER" ? { customer: { userId: req.user.id } } : {};
    res.json(await prisma.payment.findMany({ where, include: { invoice: true, customer: true }, orderBy: { createdAt: "desc" } }));
  } catch (e) { next(e); }
});
router.post("/payments/manual", adminStaff, async (req, res, next) => {
  try {
    const d = z.object({ invoiceId: z.string(), amount: z.coerce.number().positive(), method: z.string(), reference: z.string().optional(), note: z.string().optional() }).parse(req.body);
    const result = await prisma.$transaction(async tx => {
      const invoice = await tx.invoice.findUnique({ where: { id: d.invoiceId } });
      if (!invoice || ["CANCELLED","PAID"].includes(invoice.status)) throw new Error("Invoice is not payable");
      const remaining = Number(invoice.total) - Number(invoice.amountPaid);
      if (d.amount > remaining + 0.001) throw new Error("Payment exceeds outstanding balance");
      const payment = await tx.payment.create({ data: { customerId: invoice.customerId, invoiceId: invoice.id, amount: d.amount, method: d.method, reference: d.reference, note: d.note, status: "SUCCEEDED", paidAt: new Date() } });
      const paid = Number(invoice.amountPaid) + d.amount;
      const updated = await tx.invoice.update({ where: { id: invoice.id }, data: { amountPaid: paid, status: paid >= Number(invoice.total) ? "PAID" : "PARTIALLY_PAID" } });
      return { payment, invoice: updated };
    });
    res.status(201).json(result);
  } catch (e) { next(e); }
});

module.exports = router;
