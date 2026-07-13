import { Schema, model } from 'mongoose';

const eventQuoteSchema = new Schema({
  eventRequest: { type: Schema.Types.ObjectId, ref: 'EventRequest' },
  vendor: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  status: {
    type: String,
    enum: ['pending', 'accepted', 'declined', 'withdrawn', 'countered'],
    default: 'pending',
  },
  quoteAmount: { type: Number },
  amount: { type: Number },
  message: { type: String },
  isDeleted: { type: Boolean, default: false },
}, { timestamps: true });

export const EventQuote = model('EventQuote', eventQuoteSchema);
