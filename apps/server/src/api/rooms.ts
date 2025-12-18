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
import type { LanguageCode } from '../websocket/types.js';
import { directionToLanguages } from '../websocket/types.js';
import { isValidLanguageCode } from '../languages.js';
import { qrMapperService } from '../services/qr.js';
import { generateQRCode } from '../services/qr-local.js';
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
  const { name, slug, sourceLanguage, targetLanguage, direction, isPublic } = req.body as {
    name: string;
    slug: string;
    sourceLanguage?: LanguageCode;
    targetLanguage?: LanguageCode;
    direction?: string; // For backwards compatibility
    isPublic?: boolean;
  };

  // Validate required fields
  if (!name || !slug) {
    return res.status(400).json({ error: 'Name and slug are required' });
  }

  // Validate slug format
  if (!/^[a-z0-9-]+$/.test(slug) || slug.length < 3 || slug.length > 50) {
    return res.status(400).json({
      error: 'Slug must be 3-50 characters, lowercase letters, numbers, and hyphens only',
    });
  }

  // Check if slug already exists
  const existing = getRoomBySlug(slug);
  if (existing) {
    return res.status(409).json({ error: 'Room with this URL already exists' });
  }

  // Handle language selection - new fields or backwards compatibility
  let srcLang: LanguageCode = sourceLanguage || 'en';
  let tgtLang: LanguageCode = targetLanguage || 'es';

  // Backwards compatibility: convert direction to source/target
  if (direction && !sourceLanguage && !targetLanguage) {
    if (direction === 'es-to-en' || direction === 'en-to-es') {
      const converted = directionToLanguages(direction);
      srcLang = converted.sourceLanguage;
      tgtLang = converted.targetLanguage;
    }
  }

  // Validate language codes
  if (!isValidLanguageCode(srcLang) || !isValidLanguageCode(tgtLang)) {
    return res.status(400).json({ error: 'Invalid source or target language code' });
  }

  try {
    const room = createPersistentRoom({
      name,
      slug,
      sourceLanguage: srcLang,
      targetLanguage: tgtLang,
      isPublic: isPublic ?? false,
      ownerId: req.user!.id,
    });

    // Generate QR code asynchronously (don't block room creation)
    const roomUrl = `${config.frontendUrl}/room/${room.slug}`;

    if (qrMapperService.isConfigured()) {
      // Try QRMapper first
      qrMapperService.createQR(roomUrl, room.name)
        .then(async (qrResponse) => {
          if (qrResponse.status === 'Success' && qrResponse.qr_id) {
            // Get full QR info to get the image URL
            const qrInfo = await qrMapperService.getQRInfo(qrResponse.qr_id);
            if (qrInfo.image_url) {
              updateRoomQR(room.id, qrResponse.qr_id, qrInfo.image_url);
            }
          }
        })
        .catch(async (err) => {
          console.error('QRMapper failed, using local generation:', err);
          // Fallback: local QR generation
          try {
            const { dataUrl } = await generateQRCode(roomUrl);
            updateRoomQR(room.id, `local-${room.id}`, dataUrl);
          } catch (localErr) {
            console.error('Failed to generate local QR code:', localErr);
          }
        });
    } else {
      // QRMapper not configured - generate locally
      generateQRCode(roomUrl)
        .then(({ dataUrl }) => {
          updateRoomQR(room.id, `local-${room.id}`, dataUrl);
        })
        .catch((err) => {
          console.error('Failed to generate local QR code:', err);
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
  const { name, sourceLanguage, targetLanguage, direction, isPublic } = req.body as {
    name?: string;
    sourceLanguage?: LanguageCode;
    targetLanguage?: LanguageCode;
    direction?: string; // For backwards compatibility
    isPublic?: boolean;
  };

  // Handle language updates - new fields or backwards compatibility
  let srcLang: LanguageCode | undefined = sourceLanguage;
  let tgtLang: LanguageCode | undefined = targetLanguage;

  // Backwards compatibility: convert direction to source/target
  if (direction && !sourceLanguage && !targetLanguage) {
    if (direction === 'es-to-en' || direction === 'en-to-es') {
      const converted = directionToLanguages(direction);
      srcLang = converted.sourceLanguage;
      tgtLang = converted.targetLanguage;
    }
  }

  // Validate language codes if provided
  if (srcLang && !isValidLanguageCode(srcLang)) {
    return res.status(400).json({ error: 'Invalid source language code' });
  }
  if (tgtLang && !isValidLanguageCode(tgtLang)) {
    return res.status(400).json({ error: 'Invalid target language code' });
  }

  const room = updatePersistentRoom(id, req.user!.id, {
    name,
    sourceLanguage: srcLang,
    targetLanguage: tgtLang,
    isPublic,
  });

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

  const roomUrl = `${config.frontendUrl}/room/${room.slug}`;

  // Check if room already has a QR code
  if (room.qrId) {
    // For local QR codes, just return cached data
    if (room.qrId.startsWith('local-')) {
      return res.json({
        qrId: room.qrId,
        qrImageUrl: room.qrImageUrl,
        scanCount: 0,
      });
    }

    // For QRMapper codes, try to get latest info
    if (qrMapperService.isConfigured()) {
      try {
        const qrInfo = await qrMapperService.getQRInfo(room.qrId);
        return res.json({
          qrId: room.qrId,
          qrImageUrl: qrInfo.image_url || room.qrImageUrl,
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

    return res.json({
      qrId: room.qrId,
      qrImageUrl: room.qrImageUrl,
      scanCount: 0,
    });
  }

  // Create new QR code - try QRMapper first, fallback to local
  if (qrMapperService.isConfigured()) {
    try {
      const qrResponse = await qrMapperService.createQR(roomUrl, room.name);

      if (qrResponse.status === 'Success' && qrResponse.qr_id) {
        // Get full QR info
        const qrInfo = await qrMapperService.getQRInfo(qrResponse.qr_id);

        if (qrInfo.image_url) {
          updateRoomQR(room.id, qrResponse.qr_id, qrInfo.image_url);
        }

        return res.json({
          qrId: qrResponse.qr_id,
          qrImageUrl: qrInfo.image_url,
          scanCount: 0,
        });
      }
    } catch (error) {
      console.error('QRMapper failed, falling back to local generation:', error);
      // Fall through to local generation
    }
  }

  // Local QR generation (fallback or primary if QRMapper not configured)
  try {
    const { dataUrl } = await generateQRCode(roomUrl);
    const localQrId = `local-${room.id}`;
    updateRoomQR(room.id, localQrId, dataUrl);

    res.json({
      qrId: localQrId,
      qrImageUrl: dataUrl,
      scanCount: 0,
    });
  } catch (error) {
    console.error('Failed to generate local QR code:', error);
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

  // For local QR codes, no scan tracking available
  if (room.qrId.startsWith('local-')) {
    return res.json({
      qrId: room.qrId,
      qrImageUrl: room.qrImageUrl,
      scanCount: 0,
    });
  }

  // For QRMapper codes, get scan count
  if (qrMapperService.isConfigured()) {
    try {
      const qrInfo = await qrMapperService.getQRInfo(room.qrId);
      return res.json({
        qrId: room.qrId,
        qrImageUrl: qrInfo.image_url || room.qrImageUrl,
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
