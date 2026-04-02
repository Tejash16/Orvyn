const mongoose = require('mongoose');

const sharedDataRoomSchema = new mongoose.Schema({
  // Source DataRoom (UUID from sharer's SQLite)
  sourceDataroomId: { type: String, required: true },
  sourceDataroomName: { type: String, required: true },
  sourceDataroomDescription: { type: String, default: '' },

  // Owner (sharer)
  ownerId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  ownerName: { type: String, required: true },

  // Snapshot data
  folderTree: { type: mongoose.Schema.Types.Mixed, required: true },
  // Each file: { id, original_name, file_extension, size_bytes, extracted_text,
  //              ai_summary, folder_id, classification_confidence,
  //              classification_reasoning, entities: [{ type, value, context }] }
  files: [{ type: mongoose.Schema.Types.Mixed }],

  fileCount: { type: Number, default: 0 },
  folderCount: { type: Number, default: 0 },
  snapshotVersion: { type: Number, default: 1 },
  snapshotCreatedAt: { type: Date, default: Date.now },

  isDeleted: { type: Boolean, default: false },
}, { timestamps: true });

sharedDataRoomSchema.index({ ownerId: 1 });

module.exports = mongoose.model('SharedDataRoom', sharedDataRoomSchema);
