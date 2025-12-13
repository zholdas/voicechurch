import { Router, Request, Response, NextFunction } from 'express';
import {
  getPublicRoomsWithStatus,
  getUserRoomsWithStatus,
  getRoomWithStatus,
  createPersistentRoom,
  deletePersistentRoom,
  updatePersistentRoom,
  getRoomBySlug,
  updateRoomQR,
  getRoom,
} from '../websocket/rooms.js';
import type { TranslationDirection } from '../websocket/types.js';
import { qrMapperService } from '../services/qr.js';
import { config } from '../config.js';

const router = Router();

// Middleware to check authentication
function requireAuth(req: Request, res: Response, next: NextFunction): void {
  if (req.isAuthenticated() && req.user) {
    next();
  } else {
    res.status(401).json({ error: 'Authentication required' });
  }
}

// GET /api/rooms/public - Get all public rooms (no auth required)
router.get('/public', (req, res) => {
  const rooms = getPublicRoomsWithStatus();
  res.json(rooms);
});

// GET /api/rooms/my - Get current user's rooms (auth required)
router.get('/my', requireAuth, (req, res) => {
  const rooms = getUserRoomsWithStatus(req.user!.id);
  res.json(rooms);
});

// GET /api/rooms/:slug - Get room by slug (no auth required, for listeners)
router.get('/:slug', (req, res) => {
  const { slug } = req.params;
  const room = getRoomWithStatus(slug);

  if (!room) {
    return res.status(404).json({ error: 'Room not found' });
  }

  res.json(room);
});

// POST /api/rooms - Create a new room (auth required)
router.post('/', requireAuth, (req, res) => {
  const { name, slug, direction, isPublic } = req.body as {
    name: string;
    slug: string;
    direction?: TranslationDirection;
    isPublic?: boolean;
  };

  // Validate required fields
  if (!name || !slug) {
    return res.status(400).json({ error: 'Name and slug are required' });
  }

  // Validate slug format
  if (!/^[a-z0-9-]+$/.test(slug) || slug.length < 3 || slug.length > 50) {
    return res.status(400).json({
      error: 'Slug must be 3-50 characters, lowercase letters, numbers, and hyphens only'
    });
  }

  // Check if slug already exists
  const existing = getRoomBySlug(slug);
  if (existing) {
    return res.status(409).json({ error: 'Room with this URL already exists' });
  }

  try {
    const room = createPersistentRoom({
      name,
      slug,
      direction: direction || 'es-to-en',
      isPublic: isPublic ?? false,
      ownerId: req.user!.id,
    });

    // Generate QR code asynchronously (don't block room creation)
    if (qrMapperService.isConfigured()) {
      const roomUrl = `${config.frontendUrl}/room/${room.slug}`;
      qrMapperService.createQR(roomUrl, room.name)
        .then(async (qrResponse) => {
          if (qrResponse.status === 'success' && qrResponse.qr_id) {
            // Get full QR info to get the image URL
            const qrInfo = await qrMapperService.getQRInfo(qrResponse.qr_id);
            if (qrInfo.qr_image_url) {
              updateRoomQR(room.id, qrResponse.qr_id, qrInfo.qr_image_url);
            }
          }
        })
        .catch((err) => {
          console.error('Failed to create QR code:', err);
        });
    }

    res.status(201).json(room);
  } catch (error) {
    console.error('Failed to create room:', error);
    res.status(500).json({ error: 'Failed to create room' });
  }
});

// PUT /api/rooms/:id - Update a room (auth required, owner only)
router.put('/:id', requireAuth, (req, res) => {
  const { id } = req.params;
  const { name, direction, isPublic } = req.body as {
    name?: string;
    direction?: TranslationDirection;
    isPublic?: boolean;
  };

  const room = updatePersistentRoom(id, req.user!.id, { name, direction, isPublic });

  if (!room) {
    return res.status(404).json({ error: 'Room not found or not authorized' });
  }

  res.json(room);
});

// DELETE /api/rooms/:id - Delete a room (auth required, owner only)
router.delete('/:id', requireAuth, (req, res) => {
  const { id } = req.params;

  const success = deletePersistentRoom(id, req.user!.id);

  if (!success) {
    return res.status(404).json({ error: 'Room not found or not authorized' });
  }

  res.json({ success: true });
});

// POST /api/rooms/:id/qr - Generate QR code for a room (auth required, owner only)
router.post('/:id/qr', requireAuth, async (req, res) => {
  const { id } = req.params;

  // Find room by ID
  const room = getRoom(id);
  if (!room || room.ownerId !== req.user!.id) {
    return res.status(404).json({ error: 'Room not found or not authorized' });
  }

  // Check if QRMapper is configured
  if (!qrMapperService.isConfigured()) {
    return res.status(503).json({ error: 'QR code service not configured' });
  }

  // Check if room already has a QR code
  if (room.qrId) {
    // Get latest info
    try {
      const qrInfo = await qrMapperService.getQRInfo(room.qrId);
      return res.json({
        qrId: room.qrId,
        qrImageUrl: qrInfo.qr_image_url || room.qrImageUrl,
        scanCount: qrInfo.scan_count || 0,
      });
    } catch (error) {
      console.error('Failed to get QR info:', error);
      return res.json({
        qrId: room.qrId,
        qrImageUrl: room.qrImageUrl,
        scanCount: 0,
      });
    }
  }

  // Create new QR code
  try {
    const roomUrl = `${config.frontendUrl}/room/${room.slug}`;
    const qrResponse = await qrMapperService.createQR(roomUrl, room.name);

    if (qrResponse.status !== 'success' || !qrResponse.qr_id) {
      return res.status(500).json({ error: 'Failed to create QR code' });
    }

    // Get full QR info
    const qrInfo = await qrMapperService.getQRInfo(qrResponse.qr_id);

    if (qrInfo.qr_image_url) {
      updateRoomQR(room.id, qrResponse.qr_id, qrInfo.qr_image_url);
    }

    res.json({
      qrId: qrResponse.qr_id,
      qrImageUrl: qrInfo.qr_image_url,
      scanCount: 0,
    });
  } catch (error) {
    console.error('Failed to create QR code:', error);
    res.status(500).json({ error: 'Failed to create QR code' });
  }
});

// GET /api/rooms/:id/qr - Get QR code info and scan count (auth required, owner only)
router.get('/:id/qr', requireAuth, async (req, res) => {
  const { id } = req.params;

  // Find room by ID
  const room = getRoom(id);
  if (!room || room.ownerId !== req.user!.id) {
    return res.status(404).json({ error: 'Room not found or not authorized' });
  }

  if (!room.qrId) {
    return res.status(404).json({ error: 'No QR code for this room' });
  }

  // Get scan count from QRMapper
  if (qrMapperService.isConfigured()) {
    try {
      const qrInfo = await qrMapperService.getQRInfo(room.qrId);
      return res.json({
        qrId: room.qrId,
        qrImageUrl: qrInfo.qr_image_url || room.qrImageUrl,
        scanCount: qrInfo.scan_count || 0,
      });
    } catch (error) {
      console.error('Failed to get QR info:', error);
    }
  }

  res.json({
    qrId: room.qrId,
    qrImageUrl: room.qrImageUrl,
    scanCount: 0,
  });
});

export { router as roomsRouter };
