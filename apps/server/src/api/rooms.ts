import { Router, Request, Response, NextFunction } from 'express';
import {
  getPublicRoomsWithStatus,
  getUserRoomsWithStatus,
  getRoomWithStatus,
  createPersistentRoom,
  deletePersistentRoom,
  updatePersistentRoom,
  getRoomBySlug,
} from '../websocket/rooms.js';
import type { TranslationDirection } from '../websocket/types.js';

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

export { router as roomsRouter };
