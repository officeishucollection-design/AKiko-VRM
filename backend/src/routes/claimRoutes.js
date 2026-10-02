import express from 'express';
import Claim from '../models/Claim.js';
import Record from '../models/Record.js';
import { protect, authorize } from '../middleware/auth.js';

const router = express.Router();

// @desc    List all claims with optional filters
// @route   GET /api/claims
// @access  Private
router.get('/claims', protect, async (req, res) => {
  try {
    const { marketplace, status, search } = req.query;

    const query = {};
    if (marketplace) query.marketplace = marketplace;
    if (status) query.status = status;
    if (search) {
      query.suborderId = { $regex: search.trim(), $options: 'i' };
    }

    const claims = await Claim.find(query).sort({ createdAt: -1 });
    res.json({ success: true, claims });
  } catch (error) {
    console.error('Error fetching claims:', error);
    res.status(500).json({ error: 'Failed to fetch claims: ' + error.message });
  }
});

// @desc    Get a single claim by ID
// @route   GET /api/claims/:id
// @access  Private
router.get('/claims/:id', protect, async (req, res) => {
  try {
    const claim = await Claim.findById(req.params.id)
      .populate('returnRecordId')
      .populate('orderRecordId');

    if (!claim) {
      return res.status(404).json({ error: 'Claim not found' });
    }

    res.json({ success: true, claim });
  } catch (error) {
    console.error('Error fetching claim:', error);
    res.status(500).json({ error: 'Failed to fetch claim: ' + error.message });
  }
});

// @desc    Create a new claim
// @route   POST /api/claims
// @access  Private
router.post('/claims', protect, async (req, res) => {
  try {
    const {
      suborderId,
      awb,
      snapdealRefCode,
      marketplace,
      productTitle,
      sku,
      sellingPrice,
      courier,
      deliveredDate,
      disputeDeadlineDate,
    } = req.body;

    if (!suborderId || !awb) {
      return res.status(400).json({ error: 'suborderId and awb are required' });
    }

    const claim = await Claim.create({
      suborderId: suborderId.trim(),
      awb: awb.trim(),
      snapdealRefCode,
      marketplace,
      productTitle,
      sku,
      sellingPrice,
      courier,
      deliveredDate,
      disputeDeadlineDate,
    });

    res.status(201).json({ success: true, claim });
  } catch (error) {
    console.error('Error creating claim:', error);
    res.status(500).json({ error: 'Failed to create claim: ' + error.message });
  }
});

// @desc    Update a claim (status, evidence, verificationLogs, submissionResponse, etc.)
// @route   PATCH /api/claims/:id
// @access  Private
router.patch('/claims/:id', protect, async (req, res) => {
  try {
    const claim = await Claim.findByIdAndUpdate(
      req.params.id,
      { $set: req.body },
      { new: true, runValidators: true }
    );

    if (!claim) {
      return res.status(404).json({ error: 'Claim not found' });
    }

    res.json({ success: true, claim });
  } catch (error) {
    console.error('Error updating claim:', error);
    res.status(500).json({ error: 'Failed to update claim: ' + error.message });
  }
});

// @desc    Delete a claim
// @route   DELETE /api/claims/:id
// @access  Private/Admin
router.delete('/claims/:id', protect, authorize('admin'), async (req, res) => {
  try {
    const claim = await Claim.findByIdAndDelete(req.params.id);

    if (!claim) {
      return res.status(404).json({ error: 'Claim not found' });
    }

    res.json({ success: true, message: `Successfully deleted claim ${req.params.id}` });
  } catch (error) {
    console.error('Error deleting claim:', error);
    res.status(500).json({ error: 'Failed to delete claim: ' + error.message });
  }
});

// @desc    Find dispatch (type='order') Record by suborderId to link a return scan
// @route   GET /api/records/link-order/:suborderId
// @access  Private
router.get('/records/link-order/:suborderId', protect, async (req, res) => {
  try {
    const { suborderId } = req.params;

    const record = await Record.findOne({
      suborderId: suborderId.trim(),
      type: 'order',
    });

    if (!record) {
      return res.json({ found: false });
    }

    res.json({ found: true, record });
  } catch (error) {
    console.error('Error linking order record:', error);
    res.status(500).json({ error: 'Failed to link order record: ' + error.message });
  }
});

export default router;
