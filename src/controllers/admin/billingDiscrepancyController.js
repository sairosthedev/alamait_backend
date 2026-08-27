const Application = require('../../models/Application');
const BillingDiscrepancyService = require('../../services/billingDiscrepancyService');
const {
    parseComparisonText,
    parseComparisonFile
} = require('../../utils/accrualListParser');

async function parseUploadRows(req) {
    if (req.file?.buffer) {
        return parseComparisonFile(
            req.file.buffer,
            req.file.originalname,
            req.file.mimetype
        );
    }
    if (req.body?.text) {
        return parseComparisonText(req.body.text);
    }
    if (req.body?.rows && Array.isArray(req.body.rows)) {
        return req.body.rows;
    }
    return null;
}

function extractResidenceInput(req) {
    const raw =
        req.body?.residenceId
        || req.body?.residence_id
        || req.query?.residenceId
        || req.query?.residence_id;

    if (raw) return raw;

    if (req.body?.residence) {
        if (typeof req.body.residence === 'string') {
            try {
                const parsed = JSON.parse(req.body.residence);
                return parsed._id || parsed.id || parsed.name || req.body.residence;
            } catch {
                return req.body.residence;
            }
        }
        return req.body.residence._id || req.body.residence.id || req.body.residence.name;
    }

    return null;
}

/**
 * Rent accrual reconciliation — scan, compare, and fix missing lease_start / monthly accruals.
 */
class BillingDiscrepancyController {
    /**
     * GET /api/admin/billing-discrepancies/scan
     * Query: month, year, residenceId, tolerance
     */
    static async scanPeriod(req, res) {
        try {
            const month = req.query.month ? parseInt(req.query.month, 10) : undefined;
            const year = req.query.year ? parseInt(req.query.year, 10) : undefined;
            const residenceId = req.query.residenceId || undefined;
            const tolerance = req.query.tolerance ? parseFloat(req.query.tolerance) : 0.01;

            const result = await BillingDiscrepancyService.scanPeriod({
                month,
                year,
                residenceId,
                tolerance
            });

            res.status(200).json({
                success: true,
                message: `Found ${result.summary.issueCount} issue(s): ${result.summary.rentAccrualIssueCount} rent accrual, ${result.summary.leaseIssueCount} lease`,
                data: result
            });
        } catch (error) {
            console.error('Billing discrepancy scan error:', error);
            res.status(500).json({
                success: false,
                message: 'Failed to scan billing discrepancies',
                error: error.message
            });
        }
    }

    /**
     * POST /api/admin/billing-discrepancies/compare
     * Body: { entries: [{ name, amount }], month, year, residenceId, tolerance }
     */
    static async compareList(req, res) {
        try {
            const { entries, month, year, residenceId, tolerance } = req.body;

            if (!entries || !Array.isArray(entries) || entries.length === 0) {
                return res.status(400).json({
                    success: false,
                    message: 'entries array is required (each: { name, amount })'
                });
            }

            const result = await BillingDiscrepancyService.compareExternalList({
                entries,
                month: month ? parseInt(month, 10) : undefined,
                year: year ? parseInt(year, 10) : undefined,
                residenceId,
                tolerance: tolerance ?? 0.01
            });

            res.status(200).json({
                success: true,
                message: `${result.summary.mismatchCount} mismatch(es) found`,
                data: result
            });
        } catch (error) {
            console.error('Billing list compare error:', error);
            res.status(500).json({
                success: false,
                message: 'Failed to compare external list',
                error: error.message
            });
        }
    }

    /**
     * POST .../reconcile — Rent accrual reconciliation (admin + finance).
     * Admin may also pass actualLeaseEndDate to update lease then reconcile accruals.
     */
    static async reconcileRentAccruals(req, res) {
        try {
            const {
                applicationId,
                studentId,
                actualLeaseEndDate,
                month,
                year,
                actualAmount,
                dryRun
            } = req.body;

            if (!applicationId && !studentId) {
                return res.status(400).json({
                    success: false,
                    message: 'applicationId or studentId is required'
                });
            }

            const isAdmin = req.user?.role === 'admin';
            if (actualLeaseEndDate && !isAdmin) {
                return res.status(403).json({
                    success: false,
                    message: 'Only admin can update lease end date during reconciliation. Finance should ask admin to update the lease first.'
                });
            }

            const result = await BillingDiscrepancyService.reconcileRentAccruals({
                applicationId,
                studentId,
                actualLeaseEndDate,
                allowLeaseUpdate: isAdmin,
                month: month ? parseInt(month, 10) : undefined,
                year: year ? parseInt(year, 10) : undefined,
                actualAmount,
                dryRun: dryRun === true,
                adminUser: req.user
            });

            if (result.success) {
                res.status(200).json({
                    success: true,
                    message: result.dryRun
                        ? `Dry run — rent accrual reconciliation for ${result.studentName}`
                        : `Rent accrual reconciliation complete for ${result.studentName}`,
                    data: result
                });
            } else {
                res.status(400).json({
                    success: false,
                    message: result.error || 'Rent accrual reconciliation failed',
                    data: result
                });
            }
        } catch (error) {
            console.error('Billing reconcile error:', error);
            res.status(500).json({
                success: false,
                message: 'Failed to reconcile student',
                error: error.message
            });
        }
    }

    /**
     * POST /api/admin/billing-discrepancies/bulk-fix
     * Body: { targets: [{ applicationId, studentId?, actualLeaseEndDate? }], month?, year?, dryRun? }
     */
    static async bulkFix(req, res) {
        try {
            const { targets, month, year, dryRun } = req.body;

            if (!targets || !Array.isArray(targets) || targets.length === 0) {
                return res.status(400).json({
                    success: false,
                    message: 'targets array is required'
                });
            }

            const result = await BillingDiscrepancyService.bulkReconcile({
                targets,
                month: month ? parseInt(month, 10) : undefined,
                year: year ? parseInt(year, 10) : undefined,
                dryRun: dryRun === true,
                allowLeaseUpdate: req.user?.role === 'admin',
                adminUser: req.user
            });

            res.status(200).json({
                success: result.success,
                message: dryRun
                    ? `Dry run: would fix ${result.summary.total} student rent accrual(s)`
                    : `Rent accrual reconciliation: ${result.summary.fixed}/${result.summary.total} student(s)`,
                data: result
            });
        } catch (error) {
            console.error('Billing bulk fix error:', error);
            res.status(500).json({
                success: false,
                message: 'Failed to bulk fix discrepancies',
                error: error.message
            });
        }
    }

    /**
     * POST /api/admin/billing-discrepancies/auto-fix
     * Body: { month, year, residenceId?, dryRun? }
     */
    static async autoFixPeriod(req, res) {
        try {
            const { month, year, residenceId, dryRun } = req.body;

            const result = await BillingDiscrepancyService.autoFixPeriod({
                month: month ? parseInt(month, 10) : undefined,
                year: year ? parseInt(year, 10) : undefined,
                residenceId,
                dryRun: dryRun !== false,
                allowLeaseUpdate: req.user?.role === 'admin',
                adminUser: req.user
            });

            res.status(200).json({
                success: true,
                message: result.dryRun
                    ? `Dry run: would reconcile rent accruals for ${result.wouldFixCount} student(s)`
                    : `Rent accrual auto-fix: ${result.before?.rentAccrualIssueCount ?? result.before?.issueCount} → ${result.after?.rentAccrualIssueCount ?? result.after?.issueCount} accrual issues`,
                data: result
            });
        } catch (error) {
            console.error('Billing auto-fix error:', error);
            res.status(500).json({
                success: false,
                message: 'Failed to auto-fix period',
                error: error.message
            });
        }
    }

    /**
     * GET /api/admin/billing-discrepancies/student/:studentId/diagnose
     * Query: month, year
     */
    static async diagnoseStudent(req, res) {
        try {
            const { studentId } = req.params;
            const month = parseInt(req.query.month, 10) || new Date().getMonth() + 1;
            const year = parseInt(req.query.year, 10) || new Date().getFullYear();

            const TenantAccrualCheckService = require('../../services/tenantAccrualCheckService');

            const [diagnosis, validation] = await Promise.all([
                TenantAccrualCheckService.diagnoseMissingAccrual(studentId, month, year),
                Application.findOne({
                    student: studentId,
                    status: 'approved'
                }).then(async (app) => {
                    if (!app) return null;
                    return TenantAccrualCheckService.validateTenantAccruals(app._id.toString(), false);
                })
            ]);

            res.status(200).json({
                success: true,
                data: {
                    period: { month, year },
                    diagnosis,
                    validation: validation?.validation || null
                }
            });
        } catch (error) {
            console.error('Billing diagnose error:', error);
            res.status(500).json({
                success: false,
                message: 'Failed to diagnose student',
                error: error.message
            });
        }
    }

    /**
     * POST /api/admin/rent-accrual-reconciliation/upload-compare
     * Upload or paste actual-vs-system list. Form: file OR body.text OR body.rows
     * Query/body: month, year, residenceId, tolerance
     */
    static async uploadCompare(req, res) {
        try {
            const month = parseInt(req.body.month || req.query.month, 10) || undefined;
            const year = parseInt(req.body.year || req.query.year, 10) || undefined;
            const residenceInput = extractResidenceInput(req);
            const tolerance = req.body.tolerance != null ? parseFloat(req.body.tolerance) : 0.01;

            if (!residenceInput) {
                return res.status(400).json({
                    success: false,
                    message: 'residenceId is required — select a property (e.g. Belvedere) so compare/fix only runs for that residence'
                });
            }

            const rows = await parseUploadRows(req);
            if (!rows?.length) {
                return res.status(400).json({
                    success: false,
                    message: 'Provide a file (Excel/CSV), body.text (pasted list), or body.rows array'
                });
            }

            const result = await BillingDiscrepancyService.compareActualVsSystemList({
                rows,
                month,
                year,
                residenceId: residenceInput,
                tolerance
            });

            if (!result.success) {
                return res.status(400).json({
                    success: false,
                    message: result.message || 'Comparison failed',
                    data: result
                });
            }

            res.status(200).json({
                success: true,
                message: `${result.residence.name} — compare actual vs system transactions: ${result.summary.issueCount} issue(s), ${result.summary.negotiateCount} to negotiate, ${result.summary.fixableCount} auto-fixable`,
                data: result
            });
        } catch (error) {
            console.error('Upload compare error:', error);
            res.status(500).json({
                success: false,
                message: 'Failed to compare uploaded list',
                error: error.message
            });
        }
    }

    /**
     * POST /api/admin/rent-accrual-reconciliation/upload-fix
     * Fix from upload-compare result, or re-upload same list with dryRun=false.
     */
    static async uploadFix(req, res) {
        try {
            const dryRun = req.body.dryRun === true || req.query.dryRun === 'true';
            const fixLeftEarly = req.body.fixLeftEarly !== false;
            const fixMissingAccruals = req.body.fixMissingAccruals !== false;
            const month = parseInt(req.body.month || req.query.month, 10) || undefined;
            const year = parseInt(req.body.year || req.query.year, 10) || undefined;
            const residenceInput = extractResidenceInput(req);

            let comparisonResult = req.body.comparisonResult;

            if (!comparisonResult) {
                const rows = await parseUploadRows(req);
                if (!rows?.length) {
                    return res.status(400).json({
                        success: false,
                        message: 'Provide comparisonResult from upload-compare, or re-upload the same list'
                    });
                }
                if (!residenceInput && !req.body.comparisonResult?.residence?.id) {
                    return res.status(400).json({
                        success: false,
                        message: 'residenceId is required when re-uploading for fix'
                    });
                }
                comparisonResult = await BillingDiscrepancyService.compareActualVsSystemList({
                    rows,
                    month,
                    year,
                    residenceId: residenceInput || req.body.comparisonResult?.residence?.id,
                    tolerance: req.body.tolerance ?? 0.01
                });
                if (!comparisonResult.success) {
                    return res.status(400).json({
                        success: false,
                        message: comparisonResult.message,
                        data: comparisonResult
                    });
                }
            }

            const result = await BillingDiscrepancyService.fixFromUploadComparison({
                comparisonResult,
                month: month || comparisonResult.period?.month,
                year: year || comparisonResult.period?.year,
                dryRun,
                allowLeaseUpdate: ['admin', 'ceo'].includes(req.user?.role),
                fixLeftEarly,
                fixMissingAccruals,
                fixCutShortLeases: req.body.fixCutShortLeases === true,
                fixNegotiations: req.body.fixNegotiations !== false,
                adminUser: req.user
            });

            res.status(200).json({
                success: result.success !== false,
                message: dryRun
                    ? `Dry run: would apply ${result.wouldFixCount ?? result.summary?.total ?? 0} action(s)`
                    : `Applied ${result.summary?.applied ?? 0} action(s)`,
                data: result
            });
        } catch (error) {
            console.error('Upload fix error:', error);
            res.status(500).json({
                success: false,
                message: 'Failed to fix from uploaded list',
                error: error.message
            });
        }
    }

    /**
     * POST .../apply-actions
     * Body: { actions: [{ type, studentId, ... }], dryRun?, residenceId? }
     */
    static async applyActions(req, res) {
        try {
            const { actions, dryRun, residenceId } = req.body;
            const residenceInput = residenceId || extractResidenceInput(req);

            if (!actions || !Array.isArray(actions) || actions.length === 0) {
                return res.status(400).json({
                    success: false,
                    message: 'actions array is required'
                });
            }

            const isAdmin = ['admin', 'ceo'].includes(req.user?.role);
            const hasLeaseAction = actions.some(a =>
                ['update_lease_end', 'extend_lease_end'].includes(a.type || a.action)
            );
            const hasAddStudentAction = actions.some(a =>
                (a.type || a.action) === 'add_student'
            );
            if ((hasLeaseAction || hasAddStudentAction) && !isAdmin) {
                return res.status(403).json({
                    success: false,
                    message: 'Only admin can update lease end dates or add students'
                });
            }

            const result = await BillingDiscrepancyService.applyReconciliationActions({
                actions,
                residenceId: residenceInput,
                dryRun: dryRun === true,
                allowLeaseUpdate: isAdmin,
                adminUser: req.user
            });

            const summary = result.summary || {};
            const skippedNote = summary.skippedManual
                ? ` (${summary.skippedManual} need room/lease details)`
                : '';

            res.status(200).json({
                success: result.success !== false,
                message: dryRun
                    ? `Dry run: ${result.wouldApply} action(s)`
                    : `Applied ${summary.applied}/${summary.total} action(s)${skippedNote}`,
                data: result
            });
        } catch (error) {
            console.error('Apply actions error:', error);
            res.status(500).json({
                success: false,
                message: 'Failed to apply reconciliation actions',
                error: error.message
            });
        }
    }

    /**
     * POST .../negotiate — single rent negotiation (admin + finance)
     */
    static async negotiateRent(req, res) {
        try {
            const {
                studentId,
                studentName,
                originalAmount,
                negotiatedAmount,
                month,
                year,
                accrualTransactionId,
                applicationId,
                debtorId,
                residenceId,
                reason
            } = req.body;

            const result = await BillingDiscrepancyService.applyReconciliationAction(
                {
                    type: 'negotiate',
                    studentId,
                    studentName,
                    originalAmount,
                    negotiatedAmount,
                    month,
                    year,
                    accrualTransactionId,
                    applicationId,
                    debtorId,
                    residenceId: residenceId || extractResidenceInput(req),
                    reason
                },
                { adminUser: req.user, allowLeaseUpdate: false }
            );

            if (result.success === false && !result.skipped) {
                return res.status(400).json({ success: false, message: result.error, data: result });
            }

            res.status(200).json({
                success: true,
                message: result.skipped ? result.message : 'Negotiation applied',
                data: result
            });
        } catch (error) {
            console.error('Negotiate error:', error);
            res.status(500).json({
                success: false,
                message: 'Failed to apply negotiation',
                error: error.message
            });
        }
    }
}

module.exports = BillingDiscrepancyController;
