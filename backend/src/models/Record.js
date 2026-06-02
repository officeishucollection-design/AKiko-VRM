import mongoose from 'mongoose';

const RecordSchema = new mongoose.Schema(
  {
    awb: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      index: true,
    },
    videoUrl: {
      type: String,
      required: false,
    },
    duration: {
      type: Number,
      required: true,
      default: 0,
    },
    type: {
      type: String,
      required: true,
      default: 'order',
      enum: ['order', 'return'],
      index: true,
    },
    photos: {
      type: [String],
      default: [],
    },
    recordedAt: {
      type: Date,
      default: Date.now,
    },
    isMock: {
      type: Boolean,
      default: false,
    }
  },
  {
    timestamps: true,
  }
);

// Add custom indexing for fast sorting
RecordSchema.index({ recordedAt: -1 });

const Record = mongoose.model('Record', RecordSchema);

export default Record;
