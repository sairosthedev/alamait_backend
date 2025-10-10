// Backfill script: Set residence on a specific TransactionEntry and its entries
// Usage: node scripts/backfill/set_residence_on_transaction.js <transactionObjectId> <residenceObjectId>

const mongoose = require('mongoose');

(async () => {
	try {
		const [,, txIdArg, residenceIdArg] = process.argv;
		if (!txIdArg || !residenceIdArg) {
			console.error('Usage: node scripts/backfill/set_residence_on_transaction.js <transactionObjectId> <residenceObjectId>');
			process.exit(1);
		}

		const TX_ID = txIdArg;
		const RES_ID = residenceIdArg;

		const MONGODB_URI = process.env.MONGODB_URI;
		if (!MONGODB_URI) {
			console.error('MONGODB_URI env var is required');
			process.exit(1);
		}

		await mongoose.connect(MONGODB_URI, { useNewUrlParser: true, useUnifiedTopology: true });

		const TransactionEntry = require('../../src/models/TransactionEntry');

		const tx = await TransactionEntry.findById(TX_ID);
		if (!tx) {
			console.error(`TransactionEntry not found: ${TX_ID}`);
			process.exit(1);
		}

		const resObjectId = new mongoose.Types.ObjectId(RES_ID);

		// Update top-level residence
		tx.residence = resObjectId;

		// Ensure metadata exists and set residence data
		tx.metadata = tx.metadata || {};
		tx.metadata.residence = resObjectId;
		tx.metadata.residenceId = resObjectId;

		// Update entries metadata
		if (Array.isArray(tx.entries)) {
			tx.entries = tx.entries.map(e => {
				const updated = { ...e.toObject?.() ? e.toObject() : e };
				updated.metadata = updated.metadata || {};
				updated.metadata.residenceId = resObjectId;
				return updated;
			});
		}

		tx.markModified('entries');
		tx.markModified('metadata');

		await tx.save();

		console.log('✅ Updated transaction residence successfully');
		console.log({ _id: tx._id.toString(), residence: tx.residence?.toString(), metadata: { residence: tx.metadata?.residence?.toString?.(), residenceId: tx.metadata?.residenceId?.toString?.() } });

		await mongoose.disconnect();
		process.exit(0);
	} catch (err) {
		console.error('❌ Backfill failed:', err);
		try { await mongoose.disconnect(); } catch (_) {}
		process.exit(1);
	}
})();
