import { Router } from 'express';
import { getRoomByQrId, updateRoomQR } from '../db/index.js';

export const webhooksRouter = Router();

// QRMapper webhook - called when QR code is created or scanned
webhooksRouter.post('/qr', (req, res) => {
  try {
    const { qr_id, target_url, image_url, name, type, event_type, scan_count } = req.body;

    console.log('QRMapper webhook received:', { qr_id, name, event_type, scan_count });

    if (event_type === 'qr_created' && qr_id && image_url) {
      // QR code was created - we'll handle this in the room creation flow
      // This webhook confirms the QR was created successfully
      console.log(`QR code created: ${qr_id}, image: ${image_url}`);
    }

    if (event_type === 'qr_scanned' && qr_id) {
      // QR code was scanned - could be used for analytics
      const room = getRoomByQrId(qr_id);
      if (room) {
        console.log(`QR scanned for room ${room.slug}: ${scan_count} total scans`);
      }
    }

    res.json({ status: 'ok' });
  } catch (error) {
    console.error('Webhook error:', error);
    res.status(500).json({ status: 'error', message: 'Internal server error' });
  }
});
