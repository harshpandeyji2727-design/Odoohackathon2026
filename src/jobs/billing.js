require("dotenv").config();
const prisma = require("../db");

function nextDate(date, interval) {
  const d = new Date(date);
  if (interval === "DAILY") d.setDate(d.getDate() + 1);
  if (interval === "WEEKLY") d.setDate(d.getDate() + 7);
  if (interval === "MONTHLY") d.setMonth(d.getMonth() + 1);
  if (interval === "YEARLY") d.setFullYear(d.getFullYear() + 1);
  return d;
}
async function run() {
  const now = new Date();
  const due = await prisma.subscription.findMany({
    where: { status: "ACTIVE", nextBillingAt: { lte: now } },
    include: { customer: true, plan: true, lines: true }
  });
  for (const sub of due) {
    await prisma.$transaction(async tx => {
      // A unique invoice number is generated per billing cycle; transaction + check makes retries safe.
      const cycleKey = `${sub.id}-${sub.nextBillingAt.toISOString().slice(0,10)}`;
      const number = `INV-${cycleKey}`;
      if (await tx.invoice.findUnique({ where: { number } })) return;
      let subtotal = 0, taxTotal = 0;
      const lines = sub.lines.map(line => {
        const base = Number(line.unitPrice) * line.quantity;
        const tax = base * Number(line.taxRate) / 100;
        subtotal += base; taxTotal += tax;
        return { description: line.description || "Subscription item", quantity: line.quantity, unitPrice: line.unitPrice, taxRate: line.taxRate, amount: base + tax };
      });
      if (!lines.length) {
        const base = Number(sub.plan.price) * sub.quantity;
        subtotal = base;
        lines.push({ description: sub.plan.name, quantity: sub.quantity, unitPrice: sub.plan.price, taxRate: 0, amount: base });
      }
      await tx.invoice.create({
        data: { number, customerId: sub.customerId, subscriptionId: sub.id, dueDate: now, subtotal, taxTotal, total: subtotal + taxTotal, lines: { create: lines } }
      });
      const next = nextDate(sub.nextBillingAt, sub.plan.interval);
      await tx.subscription.update({ where: { id: sub.id }, data: { nextBillingAt: next, ...(sub.endDate && next > sub.endDate ? { status: sub.plan.autoClose ? "CLOSED" : "ACTIVE" } : {}) } });
    });
  }
  console.log(`Billing run complete: ${due.length} due subscription(s) checked.`);
}
run().catch(e => { console.error(e); process.exitCode = 1; }).finally(() => prisma.$disconnect());
