const mongoose = require('mongoose');

const privateMessageSchema = new mongoose.Schema({
  sender: String,
  receiver: String,
  text: String,
  timestamp: { type: Date, default: Date.now },
});

module.exports = mongoose.model('PrivateMessage', privateMessageSchema);
