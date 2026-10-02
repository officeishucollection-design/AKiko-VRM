import mongoose from 'mongoose';

const ClaimSchema = new mongoose.Schema(
  {
    suborderId: { type: String, required: true, index: true, trim: true },
    awb: { type: String, required: true, index: true, trim: true },
    snapdealRefCode: { type: String, index: true, trim: true },
    marketplace: {
      type: String,
      default: 'snapdeal',
      enum: ['snapdeal', 'meesho', 'amazon', 'flipkart', 'other'],
    },
    productTitle: { type: String },
    sku: { type: String },
    sellingPrice: { type: Number },
    courier: { type: String },
    deliveredDate: { type: Date },
    disputeDeadlineDate: { type: Date },
    status: {
      type: String,
      enum: [
        'pending_inspection',
        'inspection_complete',
        'verification_mismatch',
        'ready_for_operator_confirmation',
        'dispute_raised',
        'approved',
        'rejected',
      ],
      default: 'pending_inspection',
      index: true,
    },
    verificationLogs: {
      suborderMatched: { type: Boolean },
      awbMatched: { type: Boolean },
      skuMatched: { type: Boolean },
      refCodeMatched: { type: Boolean },
      verifiedAt: { type: Date },
      mismatchDetails: { type: String },
    },
    disputeCategory: { type: String },
    disputeDescription: { type: String },
    evidence: {
      outerPackagingUrl: { type: String },
      innerPackagingUrl: { type: String },
      productImageUrl: { type: String },
      podImageUrl: { type: String },
      unboxingVideoUrl: { type: String },
      dispatchVideoUrl: { type: String },
    },
    returnRecordId: { type: mongoose.Schema.Types.ObjectId, ref: 'Record' },
    orderRecordId: { type: mongoose.Schema.Types.ObjectId, ref: 'Record' },
    operatorConfirmedBy: { type: String },
    operatorConfirmedAt: { type: Date },
    disputeFiledAt: { type: Date },
    submissionResponse: {
      success: { type: Boolean },
      ticketNumber: { type: String },
      rawResponse: { type: String },
      capturedAt: { type: Date },
    },
    notes: { type: String },
  },
  { timestamps: true }
);

ClaimSchema.index({ createdAt: -1 });
ClaimSchema.index({ suborderId: 1, marketplace: 1 });

const Claim = mongoose.model('Claim', ClaimSchema);

export default Claim;
