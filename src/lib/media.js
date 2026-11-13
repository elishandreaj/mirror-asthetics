// Image uploads: resized with sharp, stored in the `media` table (Postgres).
const crypto = require('crypto');
const multer = require('multer');
const sharp = require('sharp');
const config = require('../config');
const { query } = require('../db');
const { HttpError } = require('./util');

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: config.maxUploadMb * 1024 * 1024, files: 4 },
  fileFilter: (req, file, cb) => cb(/^image\/(jpeg|png|webp|heic|heif|gif)$/i.test(file.mimetype) ? null : new HttpError(400, 'Only image files (JPG, PNG, WEBP, HEIC) are allowed.'), true),
});

async function saveImage(buffer, { maxSize = 1600, isPrivate = false, db = { query } } = {}) {
  let img;
  try {
    img = await sharp(buffer, { failOn: 'error' }).rotate() // respect phone orientation, strips EXIF/GPS
      .resize({ width: maxSize, height: maxSize, fit: 'inside', withoutEnlargement: true })
      .webp({ quality: 82 }).toBuffer({ resolveWithObject: true });
  } catch (e) { throw new HttpError(400, 'That image could not be read. Please try a JPG or PNG.'); }
  const id = crypto.randomUUID();
  await db.query(`INSERT INTO media(id, mime, data, width, height, bytes, private) VALUES ($1,'image/webp',$2,$3,$4,$5,$6)`,
    [id, img.data, img.info.width, img.info.height, img.info.size, isPrivate]);
  return id;
}

async function deleteMedia(id, db = { query }) { if (id) await db.query('DELETE FROM media WHERE id = $1', [id]); }

const mediaUrl = id => (id ? `/media/${id}` : null);
module.exports = { upload, saveImage, deleteMedia, mediaUrl };
