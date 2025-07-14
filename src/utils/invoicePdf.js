const PDFDocument = require('pdfkit');
const { Readable } = require('stream');

function generateInvoicePdf(invoice, tenant) {
  return new Promise((resolve, reject) => {
    try {
      const doc = new PDFDocument({ margin: 50 });
      const buffers = [];
      doc.on('data', buffers.push.bind(buffers));
      doc.on('end', () => {
        const pdfBuffer = Buffer.concat(buffers);
        resolve(pdfBuffer);
      });

      // Header
      doc.fontSize(20).text('INVOICE', { align: 'center' });
      doc.moveDown();

      // Invoice Info
      doc.fontSize(12).text(`Invoice Number: ${invoice.invoiceNumber}`);
      doc.text(`Tenant: ${tenant?.name || tenant?.fullName || tenant?._id || ''}`);
      doc.text(`Unit: ${invoice.unit}`);
      doc.text(`Billing Period: ${invoice.billingPeriod}`);
      doc.text(`Due Date: ${invoice.dueDate ? new Date(invoice.dueDate).toLocaleDateString() : ''}`);
      doc.text(`Status: ${invoice.status}`);
      doc.moveDown();

      // Charges
      doc.fontSize(14).text('Charges:', { underline: true });
      let totalCharges = 0;
      invoice.charges.forEach((c, i) => {
        doc.fontSize(12).text(`${i + 1}. ${c.description}: $${c.amount.toFixed(2)}`);
        totalCharges += c.amount;
      });
      doc.moveDown();

      // Penalties
      if (invoice.penalties && invoice.penalties.length > 0) {
        doc.fontSize(14).text('Penalties:', { underline: true });
        let totalPenalties = 0;
        invoice.penalties.forEach((p, i) => {
          doc.fontSize(12).text(`${i + 1}. ${p.description}: $${p.amount.toFixed(2)}`);
          totalPenalties += p.amount;
        });
        doc.moveDown();
      }

      // Total
      const total = totalCharges + (invoice.penalties?.reduce((sum, p) => sum + p.amount, 0) || 0);
      doc.fontSize(14).text(`Total Due: $${total.toFixed(2)}`, { align: 'right' });

      doc.end();
    } catch (err) {
      reject(err);
    }
  });
}

module.exports = { generateInvoicePdf }; 