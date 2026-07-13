import { Schema, model, Types } from 'mongoose';

const vendorQuoteSchema = new Schema({
  vendor: { type: Schema.Types.ObjectId, ref: 'User' },
  isDeleted: { type: Boolean, default: false },
  offers: [{
    sender: { type: Schema.Types.ObjectId, ref: 'User' },
    createdAt: { type: Date, default: Date.now },
  }],
}, { timestamps: true });

export const VendorQuote = model('VendorQuote', vendorQuoteSchema);
