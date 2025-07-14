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

      // Company/Residence Header
      doc
        .fontSize(18)
        .font('Helvetica-Bold')
        .text(tenant.residenceName || 'Residence', { align: 'left' });
      doc.fontSize(10).font('Helvetica').text('Alamait Property Management', { align: 'left' });
      doc.moveDown(1);

      // Invoice Title and Number
      doc
        .fontSize(22)
        .font('Helvetica-Bold')
        .text('INVOICE', { align: 'center', underline: true });
      doc.moveDown(1);

      // Invoice & Tenant Info Section
      doc.fontSize(12).font('Helvetica-Bold').text('Invoice Details', { underline: true });
      doc.font('Helvetica').fontSize(11);
      doc.text(`Invoice Number: ${invoice.invoiceNumber}`);
      doc.text(`Billing Period: ${invoice.billingPeriod}`);
      doc.text(`Due Date: ${invoice.dueDate ? new Date(invoice.dueDate).toLocaleDateString() : ''}`);
      doc.text(`Status: ${invoice.status}`);
      doc.moveDown(0.5);

      doc.fontSize(12).font('Helvetica-Bold').text('Tenant Details', { underline: true });
      doc.font('Helvetica').fontSize(11);
      doc.text(`Name: ${tenant?.name || tenant?.fullName || tenant?._id || ''}`);
      doc.text(`Unit/Room: ${tenant.room || invoice.unit || ''}`);
      doc.text(`Residence: ${tenant.residenceName || ''}`);
      doc.moveDown(1);

      // Charges Table
      doc.fontSize(12).font('Helvetica-Bold').text('Charges', { underline: true });
      doc.font('Helvetica').fontSize(11);
      let totalCharges = 0;
      invoice.charges.forEach((c, i) => {
        doc.text(`${i + 1}. ${c.description}: $${c.amount.toFixed(2)}`);
        totalCharges += c.amount;
      });
      doc.moveDown(0.5);

      // Penalties Table
      if (invoice.penalties && invoice.penalties.length > 0) {
        doc.fontSize(12).font('Helvetica-Bold').text('Penalties', { underline: true });
        doc.font('Helvetica').fontSize(11);
        invoice.penalties.forEach((p, i) => {
          doc.text(`${i + 1}. ${p.description}: $${p.amount.toFixed(2)}`);
        });
        doc.moveDown(0.5);
      }

      // Total
      const total = totalCharges + (invoice.penalties?.reduce((sum, p) => sum + p.amount, 0) || 0);
      doc.fontSize(14).font('Helvetica-Bold').text(`Total Due: $${total.toFixed(2)}`, { align: 'right' });
      doc.moveDown(1);

      // Payment Instructions
      doc.fontSize(11).font('Helvetica').text('Please make payment to the account details provided by Alamait Property Management. For any queries, contact the office.', { align: 'left' });
      doc.moveDown(2);

      // Footer
      doc.fontSize(9).font('Helvetica-Oblique').text('Thank you for choosing Alamait Property Management.', { align: 'center' });

      doc.end();
    } catch (err) {
      reject(err);
    }
  });
}

module.exports = { generateInvoicePdf }; 